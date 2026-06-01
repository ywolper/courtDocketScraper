/**
 * Scraper Module
 * Fetches and parses the Indiana MyCase court page using Playwright
 */

const { chromium } = require('playwright');

const MYCASE_SEARCH_URL = 'https://public.courts.in.gov/mycase/#/vw/Search';
const CASE_SUMMARY_PATH = 'CaseSummary';
const LOAD_SETTLE_MS = 4000;
const MAX_ENTRY_LENGTH = 1200;

function normalizeEntryText(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function firstVisibleLocator(page, locatorFactories, description) {
  for (const createLocator of locatorFactories) {
    const locator = createLocator().first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      return locator;
    } catch (error) {
      // Try the next selector. MyCase markup changes occasionally.
    }
  }

  throw new Error(`${description} missing`);
}

async function firstEditableLocator(page, locatorFactories, description) {
  for (const createLocator of locatorFactories) {
    const locator = createLocator().first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      if (await locator.isEditable()) {
        return locator;
      }
    } catch (error) {
      // Try the next selector. MyCase markup changes occasionally.
    }
  }

  throw new Error(`${description} missing`);
}

async function openCaseSearch(page) {
  console.log('Opening search page');
  await page.goto(MYCASE_SEARCH_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(LOAD_SETTLE_MS);
  await page.waitForSelector('input, button, [role="tab"]', { state: 'visible' });
}

async function searchByCaseNumber(page, caseNumber) {
  console.log(`Searching case: ${caseNumber}`);

  const caseTab = page.getByRole('tab', { name: /case/i }).first();
  if (await caseTab.isVisible().catch(() => false)) {
    await caseTab.click();
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  const searchInput = await firstEditableLocator(page, [
    () => page.locator('input[aria-label*="case" i]'),
    () => page.locator('input[placeholder*="case" i]'),
    () => page.locator('input[name*="case" i]'),
    () => page.locator('input[id*="case" i]'),
    () => page.getByLabel(/^case\s*(number|#)?$/i),
    () => page.getByPlaceholder(/case\s*(number|#)/i),
    () => page.locator('input[type="search"]'),
    () => page.locator('input[type="text"]')
  ], 'Case number search input');

  await searchInput.fill(caseNumber);

  const searchButton = await firstVisibleLocator(page, [
    () => page.getByRole('button', { name: /^search$/i }),
    () => page.getByRole('button', { name: /search/i }),
    () => page.locator('button[type="submit"]'),
    () => page.locator('input[type="submit"]'),
    () => page.locator('button:has-text("Search")')
  ], 'Search submit button');

  await searchButton.click();
  await page.waitForLoadState('networkidle');
}

async function openMatchingCaseResult(page, caseNumber) {
  const matchingResultRow = page.locator('tr.result-row').filter({ hasText: caseNumber }).first();
  try {
    await matchingResultRow.waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    throw new Error(`No results found for case number ${caseNumber}`);
  }

  console.log('Results loaded');
  console.log(`Opening case: ${caseNumber}`);

  let resultRow = matchingResultRow;

  if (!(await resultRow.isVisible().catch(() => false))) {
    resultRow = page.locator('li, [role="row"], mat-row, .card, .panel')
      .filter({ hasText: caseNumber })
      .first();
  }

  if (await resultRow.isVisible().catch(() => false)) {
    await resultRow.locator('a.result-title, a[title*="Chronological Case Summary" i]').first().click();
  } else {
    const exactCaseLink = page.locator('a[title*="Chronological Case Summary" i], a.result-title, [role="link"], button')
      .filter({ hasText: caseNumber })
      .first();

    if (await exactCaseLink.isVisible().catch(() => false)) {
      await exactCaseLink.click();
    } else {
      throw new Error(`Search results loaded, but no exact case-number match was clickable: ${caseNumber}`);
    }
  }

  try {
    await page.waitForURL((url) => url.href.includes(CASE_SUMMARY_PATH), { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(LOAD_SETTLE_MS);
    await page.waitForSelector('table tbody tr, table tr, li, [role="row"]', { state: 'visible' });
  } catch (error) {
    throw new Error(`Case summary fails to load for ${caseNumber}. Current URL: ${page.url()}`);
  }

  console.log('Case summary loaded');
}

/**
 * Scrapes the MyCase court page for docket entries
 * @param {string} caseNumber - The case number to search for
 * @returns {Promise<Object>} Object containing case data and latest docket entry
 */
async function scrapeCaseData(caseNumber) {
  let browser;
  
  try {
    if (!caseNumber) {
      throw new Error('CASE_NUMBER is not set');
    }

    console.log(`[${new Date().toISOString()}] Starting scrape for case: ${caseNumber}`);
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set a reasonable timeout
    page.setDefaultTimeout(30000);
    
    await openCaseSearch(page);
    await searchByCaseNumber(page, caseNumber);
    await openMatchingCaseResult(page, caseNumber);
    
    const finalUrl = page.url();
    console.log(`Final URL after load: ${finalUrl}`);
    
    if (!finalUrl.includes(CASE_SUMMARY_PATH)) {
      throw new Error(`Case summary fails to load for ${caseNumber}. Current URL: ${finalUrl}`);
    }
    
    console.log('Scraping docket entries');

    // Extract only Chronological Case Summary / docket rows. Do not scrape body text.
    const docketData = await page.evaluate(() => {
      const DATE_RE = /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/;
      const START_DATE_RE = /^(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/;
      const ACTION_RE = /[A-Za-z]{3,}/;
      const GENERIC_UI_RE = /(?:search non-confidential cases|click the case tab|this is not the official court record|official records of court proceedings|privacy notice|terms of use|case search|mycase\.in\.gov|main navigation|home\s+search|support|help|back to top)/i;
      const NON_CCS_RE = /(?:case number|court\s+|type\s+|filed\s+|status\s+|decedent|date of death|personal representative|petitioner|attorney|address|court costs|filing fees|transaction assessment|electronic payment|balance due|amount due|payments?)/i;
      const CCS_HEADING_RE = /(?:chronological case summary|\bccs\b|case events|docket)/i;
      const ROW_SELECTOR = 'table tbody tr, table tr, li, [role="row"]';
      const STRUCTURED_CONTAINER_SELECTOR = [
        '[class*="chron" i]',
        '[id*="chron" i]',
        '[class*="ccs" i]',
        '[id*="ccs" i]',
        '[class*="docket" i]',
        '[id*="docket" i]',
        '[class*="event" i]',
        '[id*="event" i]',
        'section',
        'article',
        'mat-card',
        '.card',
        '.panel'
      ].join(',');
      
      const normalize = (text) => (text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      const elementText = (element) => normalize(element.innerText || element.textContent || '');
      
      const isValidEntry = (text) => {
        const normalized = normalize(text);
        if (!normalized || normalized.length < 12) return false;
        if (!START_DATE_RE.test(normalized)) return false;
        if (!ACTION_RE.test(normalized.replace(DATE_RE, ''))) return false;
        if (GENERIC_UI_RE.test(normalized)) return false;
        if (NON_CCS_RE.test(normalized) && !/\n/.test(normalized)) return false;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+[\d().,\-$\s]+$/.test(normalized)) return false;
        if (/(?:transaction assessment|electronic payment|court costs|filing fees)/i.test(normalized)) return false;
        return true;
      };
      
      const getRows = (container) => Array.from(container.querySelectorAll(ROW_SELECTOR));
      
      const headingContainers = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,caption,[role="heading"],strong,b'))
        .filter((element) => CCS_HEADING_RE.test(elementText(element)))
        .map((heading) => heading.closest(STRUCTURED_CONTAINER_SELECTOR) || heading.parentElement)
        .filter(Boolean);
      
      const namedContainers = Array.from(document.querySelectorAll(STRUCTURED_CONTAINER_SELECTOR))
        .filter((container) => {
          const text = elementText(container);
          return CCS_HEADING_RE.test(text) && getRows(container).some((row) => DATE_RE.test(elementText(row)));
        });
      
      const containers = [...new Set([...headingContainers, ...namedContainers])]
        .filter((container) => container !== document.body && getRows(container).length > 0)
        .sort((a, b) => getRows(a).length - getRows(b).length);
      
      const scopedRows = containers.length > 0
        ? getRows(containers[0])
        : Array.from(document.querySelectorAll(ROW_SELECTOR));
      
      const seen = new Set();
      const entries = [];
      
      scopedRows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('th,td'))
          .map(elementText)
          .filter(Boolean);
        const text = cells.length > 0 ? normalize(cells.join('\n')) : elementText(row);
        const key = text.replace(/\s+/g, ' ').toLowerCase();
        
        if (isValidEntry(text) && !seen.has(key)) {
          seen.add(key);
          entries.push({
            index: entries.length,
            text: text.substring(0, 1200)
          });
        }
      });
      
      return {
        entries: entries,
        scrapedAt: new Date().toISOString(),
        totalEntries: entries.length,
        pageTitle: document.title,
        pageUrl: window.location.href
      };
    });
    
    docketData.entries = docketData.entries.map((entry, index) => ({
      index,
      text: normalizeEntryText(entry.text).substring(0, MAX_ENTRY_LENGTH)
    }));
    docketData.totalEntries = docketData.entries.length;
    
    if (docketData.entries.length === 0) {
      throw new Error('No valid Chronological Case Summary entries found');
    }
    
    // MyCase CCS is commonly oldest-to-newest; the newest valid event is the last scoped entry.
    const latestEntry = docketData.entries[docketData.entries.length - 1];
    
    console.log(`Extracted entry count: ${docketData.totalEntries}`);
    console.log('First 3 extracted entries:');
    docketData.entries.slice(0, 3).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.text.substring(0, 200)}`);
    });
    
    return {
      success: true,
      caseNumber: caseNumber,
      latestEntry: latestEntry,
      totalEntries: docketData.totalEntries,
      scrapedAt: docketData.scrapedAt,
      pageTitle: docketData.pageTitle,
      pageUrl: docketData.pageUrl,
      allEntries: docketData.entries
    };
    
  } catch (error) {
    console.error(`Error scraping case data: ${error.message}`);
    return {
      success: false,
      error: error.message,
      caseNumber: caseNumber,
      scrapedAt: new Date().toISOString()
    };
    
  } finally {
    // Always close the browser
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

module.exports = {
  scrapeCaseData
};
