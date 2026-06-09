/**
 * Court Case Monitor - One-shot runner
 *
 * Designed for GitHub Actions or any cron-style scheduler:
 * - loads configuration from environment variables
 * - checks each configured Indiana MyCase case once
 * - sends email notifications for newly detected docket entries
 * - writes valid scrape results to lastUpdate.json
 * - exits 0 on success, 1 on failure
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { scrapeCaseData } = require('./src/scraper');
const { sendCaseUpdateEmail } = require('./src/emailService');

const CONFIG = {
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  recipientEmail: process.env.RECIPIENT_EMAIL,
  caseNumbers: parseCaseNumbers(process.env.CASE_NUMBERS || process.env.CASE_NUMBER),
  lastUpdateFile: path.join(__dirname, 'lastUpdate.json')
};

function parseCaseNumbers(value) {
  return (value || '')
    .split(/[\n,]+/)
    .map(caseNumber => caseNumber.trim())
    .filter(Boolean);
}

function maskSecret(value) {
  if (!value) {
    return 'NOT SET';
  }

  if (value.length <= 6) {
    return '***';
  }

  return `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
}

function validateConfig() {
  console.log('\n' + '='.repeat(60));
  console.log('CONFIGURATION CHECK');
  console.log('='.repeat(60));

  const missing = [];
  const required = {
    EMAIL_USER: CONFIG.emailUser,
    EMAIL_PASSWORD: CONFIG.emailPassword,
    RECIPIENT_EMAIL: CONFIG.recipientEmail
  };

  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
      console.log(`${key}: NOT SET`);
    } else {
      console.log(`${key}: ${maskSecret(value)}`);
    }
  });

  if (CONFIG.caseNumbers.length === 0) {
    missing.push('CASE_NUMBERS or CASE_NUMBER');
    console.log('CASE_NUMBERS/CASE_NUMBER: NOT SET');
  } else {
    console.log(`Case count: ${CONFIG.caseNumbers.length}`);
    CONFIG.caseNumbers.forEach(caseNumber => console.log(`Case Number: ${caseNumber}`));
  }

  console.log('='.repeat(60) + '\n');

  if (missing.length > 0) {
    console.error(`Setup error: Missing environment variables: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

function createEmptyState() {
  return {
    updatedAt: null,
    cases: {}
  };
}

function normalizeState(data) {
  if (!data || typeof data !== 'object') {
    return createEmptyState();
  }

  if (data.cases && typeof data.cases === 'object') {
    return {
      updatedAt: data.updatedAt || null,
      cases: data.cases
    };
  }

  // Backward compatibility with the old single-case lastUpdate.json shape.
  if (data.caseNumber) {
    return {
      updatedAt: data.scrapedAt || null,
      cases: {
        [data.caseNumber]: data
      }
    };
  }

  return createEmptyState();
}

function loadLastUpdate() {
  try {
    if (!fs.existsSync(CONFIG.lastUpdateFile)) {
      return createEmptyState();
    }

    const data = fs.readFileSync(CONFIG.lastUpdateFile, 'utf8');
    return normalizeState(JSON.parse(data));
  } catch (error) {
    console.warn(`Warning: Could not load last update file: ${error.message}`);
    return createEmptyState();
  }
}

function saveLastUpdate(state) {
  const stateToSave = {
    updatedAt: new Date().toISOString(),
    cases: state.cases
  };

  fs.writeFileSync(
    CONFIG.lastUpdateFile,
    JSON.stringify(stateToSave, null, 2),
    'utf8'
  );

  console.log(`Tracking file updated: ${CONFIG.lastUpdateFile}`);
}

function isValidCaseData(caseData) {
  if (!caseData || !caseData.success) {
    return false;
  }

  if (!caseData.pageUrl || !caseData.pageUrl.includes('CaseSummary') || caseData.pageUrl.includes('Search')) {
    return false;
  }

  if (!Array.isArray(caseData.allEntries) || caseData.allEntries.length === 0) {
    return false;
  }

  if (!caseData.latestEntry || typeof caseData.latestEntry.text !== 'string') {
    return false;
  }

  const latestText = caseData.latestEntry.text.trim();
  const datePattern = /^(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/;
  const hasDate = datePattern.test(latestText);
  const hasActionText = /[A-Za-z]{3,}/.test(latestText.replace(datePattern, ''));
  const isGenericUiText = /(?:search non-confidential cases|click the case tab|this is not the official court record|official records of court proceedings|privacy notice|terms of use|case search)/i.test(latestText);

  return hasDate && hasActionText && !isGenericUiText;
}

function isNewUpdate(currentData, previousData) {
  if (!isValidCaseData(previousData)) {
    return false;
  }

  const currentEntry = currentData.latestEntry?.text || '';
  const previousEntry = previousData.latestEntry?.text || '';

  return currentEntry !== previousEntry;
}

async function checkCase(caseNumber, previousData) {
  console.log('\n' + '-'.repeat(60));
  console.log(`[${new Date().toISOString()}] Checking case ${caseNumber}`);
  console.log('-'.repeat(60));

  const currentData = await scrapeCaseData(caseNumber);

  if (!currentData.success) {
    throw new Error(`Scraping failed for ${caseNumber}: ${currentData.error}`);
  }

  if (!isValidCaseData(currentData)) {
    throw new Error(`Scraping failed for ${caseNumber}: no valid CaseSummary docket entries were returned`);
  }

  const hasUpdate = isNewUpdate(currentData, previousData);

  if (hasUpdate) {
    console.log(`Update detected for ${caseNumber}`);
    console.log(`Latest entry: ${currentData.latestEntry.text.substring(0, 120)}...`);

    const emailResult = await sendCaseUpdateEmail(
      CONFIG.emailUser,
      CONFIG.emailPassword,
      CONFIG.recipientEmail,
      currentData,
      previousData
    );

    if (!emailResult.success) {
      throw new Error(`Email notification failed for ${caseNumber}: ${emailResult.error}`);
    }
  } else if (!isValidCaseData(previousData)) {
    console.log(`Valid docket baseline created for ${caseNumber}. No email sent for initial or repaired baseline.`);
  } else {
    console.log(`No new updates for ${caseNumber}.`);
    console.log(`Latest: ${currentData.latestEntry.text.substring(0, 120)}...`);
  }

  return currentData;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('COURT CASE MONITOR - One-shot check');
  console.log('='.repeat(60));
  console.log(`Start time: ${new Date().toISOString()}`);

  if (!validateConfig()) {
    return 1;
  }

  const state = loadLastUpdate();
  const failures = [];

  for (const caseNumber of CONFIG.caseNumbers) {
    try {
      const previousData = state.cases[caseNumber] || null;
      const currentData = await checkCase(caseNumber, previousData);
      state.cases[caseNumber] = currentData;
    } catch (error) {
      failures.push({ caseNumber, error });
      console.error(`Check failed for ${caseNumber}: ${error.message}`);
    }
  }

  try {
    saveLastUpdate(state);
  } catch (error) {
    failures.push({ caseNumber: 'lastUpdate.json', error });
    console.error(`Error saving tracking file: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Finished at ${new Date().toISOString()}`);
  console.log(`Cases checked: ${CONFIG.caseNumbers.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    return 1;
  }

  return 0;
}

main()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
