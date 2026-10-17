/**
 * @file modules/webhook/index.js
 * @author GPlay97
 * @description Webhook Module to be able to inform user about specific events
 */
const request = require('request');
const db = require('./../db');
// Match the parser used by request so validation and delivery agree on the host.
const parseUrl = require('url').parse;

const canSendToken = uri => {
    try {
        const url = parseUrl(uri);
        return url.protocol === 'https:' && typeof url.hostname === 'string' &&
            ['evnotify.de', 'evnotify.com'].some(domain =>
            url.hostname === domain || url.hostname.endsWith('.' + domain));
    } catch (err) {
        return false;
    }
};

module.exports = {
    /**
     * Sends Event to webhook url if specified for given type and response
     */
    emit: (akey, token, type, response) => {
        db.query('SELECT webhook FROM settings WHERE akey=?', [
            akey
        ], (err, dbRes) => {
            if (!err && dbRes && dbRes[0] && dbRes[0].webhook) {
                const sendToken = canSendToken(dbRes[0].webhook);
                const body = { akey, type, response };

                // Extended telemetry includes the incoming credentials. Never forward
                // its token implicitly or mutate the original request body.
                if (response && typeof response === 'object') {
                    body.response = Array.isArray(response) ? response.slice() : Object.assign({}, response);
                    delete body.response.token;
                }
                if (sendToken) body.token = token;

                request({
                    uri: dbRes[0].webhook,
                    method: 'POST',
                    json: true,
                    timeout: 10000,
                    followRedirect: !sendToken,
                    followAllRedirects: false,
                    body,
                    maxRedirects: 10
                }, err => {
                    if (err) console.error(err);
                });
            }
        });
    }
};
