const srv_config = require('../../../srv_config.json');
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

const client = () => {
    if (!srv_config.PAYPAL_CLIENT_ID || !srv_config.PAYPAL_CLIENT_SECRET) return;
    return new checkoutNodeJssdk.core.PayPalHttpClient(
        new checkoutNodeJssdk.core.LiveEnvironment(srv_config.PAYPAL_CLIENT_ID, srv_config.PAYPAL_CLIENT_SECRET)
    );
};

module.exports = {
    client
}