/**
 * @file modules/notification/index.js
 * @author GPlay97
 * @description Module to route and handle notifications
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    token = require('./../token');

const send = (req, res) => {
    let userObj;

    // check required params
    if (req.body.akey && req.body.token) {
        return res.status(400).json({
            error: srv_errors.INVALID_PARAMETERS
        });
    }
    // retrieve required information
    db.query('SELECT accounts.akey, token, car, email, telegram, lng, curSoC, consumption, lastNotification, telegram, email FROM accounts \
        INNER JOIN stats ON accounts.akey=stats.akey INNER JOIN settings ON settings.akey=accounts.akey WHERE accounts.akey=?', [
        req.body.akey
    ], (err, dbRes) => {
        if (!err && dbRes && (userObj = dbRes[0]) != null) {
            // validate token
            if (userObj.token === req.body.token) {
                // valid, compare lastNotification timestamp to determine if limit reached
                if ((userObj.lastNotification || 0) + 5 < parseInt(new Date() / 1000)) {
                    // route the notifications in background // TODO
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