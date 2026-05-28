const integrations = require('../config/integrations');
// Dynamically instantiate stripe if token is available
let stripe = null;
if (integrations.stripe.secretKey && !integrations.stripe.secretKey.includes('placeholder')) {
  try {
    stripe = require('stripe')(integrations.stripe.secretKey);
  } catch (err) {
    console.warn('Stripe SDK load warning:', err.message);
  }
}

/**
 * Creates dynamic Stripe checkout pipeline sessions
 */
const createCheckoutSession = async (orderId, totalAmount, customerEmail, successUrl, cancelUrl) => {
  try {
    if (!stripe) {
      // Dev simulation pipeline fallback
      console.log('Stripe missing secret key, simulating Checkout session link...');
      return {
        id: `mock_stripe_session_${Date.now()}`,
        url: `${successUrl}?session_id=mock_stripe_session_id_123`
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Pedido Alice #${orderId}`
            },
            unit_amount: Math.round(totalAmount * 100) // Stripe expects cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: { orderId },
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return { id: session.id, url: session.url };
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    // Dev fallback response
    return {
      id: `mock_stripe_session_${Date.now()}`,
      url: `${successUrl}?session_id=mock_stripe_session_id_failed`
    };
  }
};

module.exports = {
  createCheckoutSession
};
