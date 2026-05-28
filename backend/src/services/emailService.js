require('dotenv').config();

/**
 * Dispatches a formatted template layout to target email addresses
 */
const sendSystemEmail = async (toEmail, subject, textContent, htmlContent = '') => {
  try {
    // In dev, simply record telemetry log
    console.log(`[Email Service Dispatch]:
      To: ${toEmail}
      Subject: ${subject}
      Body: ${textContent}`);
      
    // Resend or Sendgrid real connection can be configured here once keys are available.
    return { success: true, messageId: `msg_${Math.round(Math.random() * 1000000)}` };
  } catch (error) {
    console.error('Email Dispatch Error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendSystemEmail
};
