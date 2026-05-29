/**
 * Email Service Module
 * Sends email notifications via Gmail SMTP
 */

const nodemailer = require('nodemailer');

/**
 * Creates and configures the email transporter
 * @param {string} emailUser - Gmail address
 * @param {string} emailPassword - Gmail app password
 * @returns {Object} Configured nodemailer transporter
 */
function createTransporter(emailUser, emailPassword) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: emailUser,
      pass: emailPassword
    }
  });
}

/**
 * Sends an email notification about case update
 * @param {string} emailUser - Gmail address
 * @param {string} emailPassword - Gmail app password
 * @param {string} recipientEmail - Email address to send notification to
 * @param {Object} caseData - Case data from scraper
 * @param {Object} previousData - Previous case data for comparison
 * @returns {Promise<Object>} Email sending result
 */
async function sendCaseUpdateEmail(emailUser, emailPassword, recipientEmail, caseData, previousData) {
  try {
    console.log(`[${new Date().toISOString()}] Preparing email notification...`);
    
    const transporter = createTransporter(emailUser, emailPassword);
    
    // Format the email content
    const isNewUpdate = !previousData || 
                        previousData.latestEntry?.text !== caseData.latestEntry?.text;
    
    const updateStatus = isNewUpdate ? '🔔 NEW UPDATE DETECTED' : 'No changes';
    
    const emailContent = `
Case Number: ${caseData.caseNumber}
Check Time: ${caseData.scrapedAt}
Status: ${updateStatus}

Latest Docket Entry:
${caseData.latestEntry ? caseData.latestEntry.text : 'No entries found'}

Total Docket Entries: ${caseData.totalEntries}

Previous Entry:
${previousData?.latestEntry?.text || 'None (first check)'}

View case details at:
${caseData.pageUrl || 'https://mycase.in.gov/'}

---
This is an automated message from Court Case Monitor
    `;

    const mailOptions = {
      from: emailUser,
      to: recipientEmail,
      subject: `[Court Case Monitor] ${caseData.caseNumber} - ${updateStatus}`,
      text: emailContent,
      html: `<pre>${escapeHtml(emailContent)}</pre>`
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✓ Email sent successfully. Message ID: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
      recipient: recipientEmail
    };

  } catch (error) {
    console.error(`✗ Failed to send email: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Escapes HTML special characters for safe email display
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  sendCaseUpdateEmail,
  createTransporter
};
