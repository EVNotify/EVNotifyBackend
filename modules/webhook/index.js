/**
 * @file modules/webhook/index.js
 * @author GPlay97
 * @description Webhook Module to be able to inform user about specific events
 */
const request = require('request');
const db = require('./../db');

module.exports = {
    /**
     * Sends Event to webhook url if specified for given type and response
     */
    emit: (akey, type, response) => {
        db.query('SELECT webhook FROM settings WHERE akey=?', [
            akey
        ], (err, dbRes) => {
            if (!err && dbRes && dbRes[0] && dbRes[0].webhook) {
                request({
                    uri: dbRes[0].webhook + '/webhook',
                    method: 'POST',
                    json: true,
                    timeout: 10000,
                    followRedirect: true,
                    body: {
                        akey,
                        type,
                        response
                    },
                    maxRedirects: 10
                }, err => {
                    if (err) console.error(err);
                });
            }
        });
    }
};