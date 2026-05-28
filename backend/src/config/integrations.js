require('dotenv').config();

module.exports = {
  meta: {
    businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '1234567890',
    accessToken: process.env.META_ACCESS_TOKEN || 'placeholder_access_token',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'alice_verify_token'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder_client_secret',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/appointments/auth/callback'
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'
  }
};
