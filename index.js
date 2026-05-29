/**
 * Court Case Monitor - Main Application
 * 
 * This application monitors an Indiana MyCase court case for updates
 * and sends email notifications when new docket entries are found.
 * 
 * Configuration: Create a .env file with your Gmail credentials
 * (See .env.example for template)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import modules
const { scrapeCaseData } = require('./src/scraper');
const { sendCaseUpdateEmail } = require('./src/emailService');
const { scheduleMonitoring, runImmediateCheck } = require('./src/scheduler');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  recipientEmail: process.env.RECIPIENT_EMAIL,
  caseNumber: process.env.CASE_NUMBER || '46C01-2511-ES-000237',
  caseUrl: process.env.CASE_URL || 'https://mycase.in.gov/cases/',
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 6, // hours
  lastUpdateFile: path.join(__dirname, 'lastUpdate.json')
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates that all required environment variables are set
 * @returns {boolean} True if all required variables are set
 */
function validateConfig() {
  console.log('\n' + '='.repeat(60));
  console.log('CONFIGURATION CHECK');
  console.log('='.repeat(60));
  
  const required = ['EMAIL_USER', 'EMAIL_PASSWORD', 'RECIPIENT_EMAIL'];
  const missing = [];
  
  required.forEach(key => {
    const value = CONFIG[key.toLowerCase()] || process.env[key];
    if (!value) {
      missing.push(key);
      console.log(`✗ ${key}: NOT SET`);
    } else {
      const masked = value.substring(0, 3) + '***' + value.substring(value.length - 3);
      console.log(`✓ ${key}: ${masked}`);
    }
  });
  
  console.log(`✓ Case Number: ${CONFIG.caseNumber}`);
  console.log(`✓ Check Interval: Every ${CONFIG.checkInterval} hour(s)`);
  console.log('='.repeat(60) + '\n');
  
  if (missing.length > 0) {
    console.error(`\n❌ SETUP ERROR: Missing environment variables: ${missing.join(', ')}`);
    console.error('\nPlease create a .env file with the required variables.');
    console.error('You can copy from .env.example and fill in your credentials.\n');
    return false;
  }
  
  return true;
}

/**
 * Loads the last known update from the tracking file
 * @returns {Object|null} Previous case data or null if no file exists
 */
function loadLastUpdate() {
  try {
    if (fs.existsSync(CONFIG.lastUpdateFile)) {
      const data = fs.readFileSync(CONFIG.lastUpdateFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Warning: Could not load last update file: ${error.message}`);
  }
  return null;
}

/**
 * Saves the current case data to the tracking file
 * @param {Object} caseData - Case data to save
 */
function saveLastUpdate(caseData) {
  try {
    fs.writeFileSync(
      CONFIG.lastUpdateFile,
      JSON.stringify(caseData, null, 2),
      'utf8'
    );
    console.log(`✓ Tracking file updated: ${CONFIG.lastUpdateFile}`);
  } catch (error) {
    console.error(`Error saving tracking file: ${error.message}`);
  }
}

/**
 * Verifies that scraped data is usable as a notification/tracking baseline.
 * @param {Object|null} caseData - Scraped or stored case data
 * @returns {boolean} True when data contains real CaseSummary docket entries
 */
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

/**
 * Detects if there's a new update by comparing current and previous data
 * @param {Object} currentData - Current case data
 * @param {Object} previousData - Previous case data
 * @returns {boolean} True if new update detected
 */
function isNewUpdate(currentData, previousData) {
  // No valid previous baseline: save current real docket state without sending.
  if (!isValidCaseData(previousData)) {
    return false;
  }
  
  // Compare latest entries
  const currentEntry = currentData.latestEntry?.text || '';
  const previousEntry = previousData.latestEntry?.text || '';
  
  return currentEntry !== previousEntry;
}

// ============================================================================
// MAIN MONITORING LOGIC
// ============================================================================

/**
 * Performs a single monitoring check
 * - Scrapes the court case page
 * - Compares with last known state
 * - Sends email if updates found
 * - Updates tracking file
 */
async function performCheck() {
  console.log(`\n[${new Date().toISOString()}] Starting monitoring check...`);
  
  try {
    // Load previous data
    const previousData = loadLastUpdate();
    
    // Scrape current data
    const currentData = await scrapeCaseData(CONFIG.caseNumber, CONFIG.caseUrl);
    
    if (!currentData.success) {
      console.error(`✗ Scraping failed: ${currentData.error}`);
      return;
    }

    if (!isValidCaseData(currentData)) {
      console.error('✗ Scraping failed: no valid CaseSummary docket entries were returned');
      return;
    }
    
    // Check if this is a new update
    const hasUpdate = isNewUpdate(currentData, previousData);
    
    if (hasUpdate) {
      console.log(`\n🔔 UPDATE DETECTED! New docket entry found.`);
      console.log(`Latest entry: ${currentData.latestEntry?.text.substring(0, 80)}...`);
      
      // Send email notification
      const emailResult = await sendCaseUpdateEmail(
        CONFIG.emailUser,
        CONFIG.emailPassword,
        CONFIG.recipientEmail,
        currentData,
        previousData
      );
      
      if (!emailResult.success) {
        console.error(`Email notification failed: ${emailResult.error}`);
      }
    } else {
      if (!isValidCaseData(previousData)) {
        console.log(`✓ Valid docket baseline created. No email sent for initial or repaired baseline.`);
      } else {
        console.log(`✓ No new updates. Last entry remains the same.`);
      }
      if (currentData.latestEntry) {
        console.log(`Latest: ${currentData.latestEntry.text.substring(0, 80)}...`);
      }
    }
    
    // Save current data as the new baseline
    saveLastUpdate(currentData);
    
    console.log(`\n✓ Check completed at ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error(`✗ Error during check: ${error.message}`);
  }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('COURT CASE MONITOR - Starting Application');
  console.log('='.repeat(60));
  console.log(`Start time: ${new Date().toISOString()}`);
  
  // Validate configuration
  if (!validateConfig()) {
    process.exit(1);
  }
  
  // Run initial check immediately
  await runImmediateCheck(performCheck);
  
  // Schedule recurring checks
  const scheduler = scheduleMonitoring(CONFIG.checkInterval, performCheck);
  
  console.log(`\n${'✓'.repeat(30)}`);
  console.log('✓ Application is now monitoring the court case');
  console.log('✓ Press Ctrl+C to stop the application');
  console.log('✓ Logs will be displayed below as checks run');
  console.log(`${'✓'.repeat(30)}\n`);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n' + '='.repeat(60));
    console.log('Shutting down...');
    scheduler.cancel();
    console.log('Application stopped');
    console.log('='.repeat(60));
    process.exit(0);
  });
}

// Start the application
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
