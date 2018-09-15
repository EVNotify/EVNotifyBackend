/**
 * Cron job file to send out last charging soc notifications for accounts that have summary option enabled
 */
var mysql = require('mysql'),
    db = require('./../../db/').getPool(),
    srv_config = require('./../../srv_config.json'),
    mail = require('./../mail/'),
    telegram = require('./../telegram');

/**
 * Retrieves all user that have summary enabled and sends out notifications for all activated types
 */
let sendNotifications = () => {
    var sql = mysql.format('SELECT accounts.akey, curSoC, lastSoC, consumption, email, push, telegram, lng, lastNotification FROM settings \
        INNER JOIN accounts ON accounts.akey=settings.akey INNER JOIN stats ON accounts.akey=stats.akey WHERE settings.summary=?', [1]);

    // retrieve users
    db.query(sql, (err, queryRes) => {
        if(!err && Array.isArray(queryRes)) {
            const now = parseInt(new Date().getTime() / 1000);

            queryRes.forEach(userObj => {
                // check if there was already a notification within the last seconds and check if user has a valid soc not older than one day
                if((userObj.lastNotification || 0) + 5 < now && userObj.soc && userObj.lastSoC && userObj.lastSoC >= now - 86400) {
                    // send notifications in background depending on type
                    if(userObj.email) mail.sendSummary(userObj.email, userObj.lng, userObj.curSoC, userObj.consumption, userObj.lastSoC);
                    // if(userObj.push) push.sendPush(userObj.akey, userObj.lng);
                    if(userObj.telegram) telegram.sendSummary(userObj.telegram, userObj.akey);
                    // update last notification timestamp
                    db.query(mysql.format('UPDATE stats SET lastNotification=? WHERE akey=?', [parseInt(new Date().getTime() / 1000), userObj.akey]));
                }
            });
        }
    });
};

/**
 * Request handling route for notification cron job
 * @param {Object} req the server request
 * @param {Object} res the server response
 */
exports.cronNotification = function(req, res) {
    // check authentication for cron route
    if(typeof req.body !== 'undefined' && req.body.CRON_KEY === srv_config.CRON_KEY) {
        sendNotifications();
        // let the notifications proceed in background
        res.json({message: 'Notifications successfully sent'});
    } else res.status(401).json({message: 'Unauthorized', error: 401});
};