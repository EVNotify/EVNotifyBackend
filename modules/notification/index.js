/**
 * @file modules/notification/index.js
 * @author GPlay97
 * @description Module to route and handle notifications
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    webhook = require('./../webhook'),
    mail = require('./mail'),
    telegram = require('./telegram'),
    push = require('./push');

/**
 * send Notification request
 * @param {Object} req the server request
 * @param {Object} res the server response
 */
const send = (req, res) => {
    let userObj;

    // check required params
    if (!req.body.akey || !req.body.token) {
        return res.status(400).json({
            error: srv_errors.INVALID_PARAMETERS
        });
    }
    // retrieve required information
    db.query('SELECT accounts.akey, token, car, email, telegram, push, lng, soc_display, soc_bms, capacity, consumption, last_notification FROM accounts \
        INNER JOIN sync ON accounts.akey=sync.akey INNER JOIN settings ON settings.akey=accounts.akey WHERE accounts.akey=?', [
        req.body.akey
    ], (err, dbRes) => {
        if (!err && dbRes && (userObj = dbRes[0]) != null) {
            // validate token
            if (userObj.token === req.body.token) {
                const now = Math.floor(Date.now() / 1000);

                // valid, compare last_notification timestamp to determine if limit reached
                if ((userObj.last_notification || 0) + 60 < now) {
                    // route the notifications in background
                    if (userObj.email) mail.sendMail(userObj, req.body.abort);
                    if (userObj.telegram) telegram.sendMessage(userObj, req.body.abort);
                    if (userObj.push) push.sendPush(userObj, req.body.abort);
                    res.json({
                        notified: true
                    });
                    // update last notification
                    db.query('UPDATE sync SET last_notification=? WHERE akey=?', [
                        now, req.body.akey
                    ]);
                    // trigger webhook
                    webhook.emit(req.body.akey, 'notification', {
                        soc_display: userObj.soc_display,
                        soc_bms: userObj.soc_bms,
                        abort: req.body.abort
                    });
                } else {
                    res.setHeader('Retry-After', 60);
                    // too many request
                    res.status(429).json({
                        error: srv_errors.TOO_MANY_REQUESTS,
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            } else {
                // invalid
                res.status(401).json({
                    error: srv_errors.INVALID_TOKEN,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        } else {
            res.status(422).json({
                error: srv_errors.UNPROCESSABLE_ENTITY,
                debug: ((srv_config.DEBUG) ? err : null)
            });
        }
    });
};

module.exports = {
    send
};
