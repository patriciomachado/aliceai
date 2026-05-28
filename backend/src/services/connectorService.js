const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/integrations');

/**
 * Sends a WhatsApp or Instagram Message via Meta Graph API
 */
const sendMessage = async (recipient, textBody, channel = 'whatsapp') => {
  try {
    const { accessToken, businessAccountId } = config.meta;
    
    if (channel === 'instagram') {
      // Instagram Graph API endpoint
      const instagramUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/messages`;
      const payload = {
        recipient: { id: recipient },
        message: { text: textBody }
      };
      
      const response = await axios.post(instagramUrl, payload, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } else {
      // WhatsApp Business API endpoint
      const whatsappUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: textBody }
      };

      const response = await axios.post(whatsappUrl, payload, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    }
  } catch (error) {
    console.error(`Meta Connector Service Send Failed [${channel}]:`, error.response?.data || error.message);
    // Graceful indicator for dev logs
    return { success: false, mock: true, recipient, message: textBody };
  }
};

/**
 * Verifies request signature for Meta Webhooks
 */
const verifySignature = (payload, headerSignature) => {
  try {
    if (!headerSignature) return false;
    const signature = headerSignature.replace('sha256=', '');
    const hmac = crypto.createHmac('sha256', config.meta.verifyToken);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(digest, 'utf-8'));
  } catch {
    return false;
  }
};

module.exports = {
  sendMessage,
  verifySignature
};
