/**
 * @file modules/notification/index.js
 * @author GPlay97
 * @description Module to route and handle notifications
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    mail = require('./mail');

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
    db.query('SELECT accounts.akey, token, car, email, telegram, lng, soc_display, soc_bms, consumption, last_notification, telegram, email FROM accounts \
        INNER JOIN sync ON accounts.akey=sync.akey INNER JOIN settings ON settings.akey=accounts.akey WHERE accounts.akey=?', [
        req.body.akey
    ], (err, dbRes) => {
        if (!err && dbRes && (userObj = dbRes[0]) != null) {
            // validate token
            if (userObj.token === req.body.token) {
                // valid, compare last_notification timestamp to determine if limit reached
                if ((userObj.last_notification || 0) + 5 < parseInt(new Date() / 1000)) {
                    // route the notifications in background
                    if (userObj.email) mail.sendMail(userObj, req.body.abort);
                    res.json({
                        notified: true
                    });
                    // TODO update last notification..
                } else {
                    // too many request
                    res.status(429).json({
                        error: srv.errors.TOO_MANY_REQUESTS,
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            } else {
                // invalid
                res.status(401).json({
                    error: srv.errors.INVALID_TOKEN,
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