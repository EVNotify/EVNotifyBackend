/**
 * Cron job file to send out last charging soc notifications for accounts that have summary option enabled
 */
var mysql = require('mysql'),
    db = require('./../../db/').getPool(),
    mail = require('./../mail/'),
    telegram = require('./../telegram');

/**
 * Retrieves all user that have summary enabled and sends out notifications for all activated types
 */
let sendNotifications = () => {
    var sql = mysql.format('SELECT accounts.akey, curSoC, lastSoC, consumption, email, push, telegram, lng, lastNotification FROM settings \
        INNER JOIN accounts ON accounts.akey=settings.akey INNER JOIN stats ON accounts.akey=stats.akey WHERE settings.summary=?', [1]),
        cnt = 0;

    // retrieve users
    db.query(sql, (err, queryRes) => {
        if(!err && Array.isArray(queryRes)) {
            queryRes.forEach(userObj => {
                // check if there was already a notification within the last seconds
                if((userObj.lastNotification || 0) + 5 < parseInt(new Date().getTime() / 1000)) {
                    // send notifications in background depending on type
                    if(userObj.email) mail.sendSummary(userObj.email, userObj.lng, userObj.curSoC, userObj.consumption, userObj.lastSoC);
                    // if(userObj.push) push.sendPush(userObj.akey, userObj.lng);
                    if(userObj.telegram) telegram.sendSummary(userObj.telegram, userObj.akey);
                    // update last notification timestamp
                    db.query(mysql.format('UPDATE stats SET lastNotification=? WHERE akey=?', [parseInt(new Date().getTime() / 1000), userObj.akey]));
                    if(++cnt === queryRes.length) {
                        // after last notification send out, wait 1 minute before process will be killed again
                        setTimeout(() => {
                            process.exit();
                        }, 60000);
                    }
                }
            });
        }
    });
};

sendNotifications();