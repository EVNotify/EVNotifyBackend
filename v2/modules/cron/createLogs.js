/**
 * @file modules/cron/createLogs.js
 * @author GPlay97
 * @description Cron file to create logs for user in background
 */
const db = require('./../db');
const util = require('util');
const query = util.promisify(db.query);

/**
 * Formats given timestamp into human readable form ( dd.mm.yyyy hh:mm:ss)
 * @param {Number} timestamp the unix timestamp to format
 * @returns {String} the formatted timestamp string
 */
const formatDate = (timestamp) => {
    var date = new Date(timestamp * 1000);

    if (!(date instanceof Date) || isNaN(date)) return '?';
    var hours = date.getHours(),
        minutes = date.getMinutes(),
        seconds = date.getSeconds(),
        day = date.getDate(),
        month = date.getMonth() + 1;

    seconds = ((seconds < 10) ? '0' + seconds : seconds); // correct low values
    minutes = ((minutes < 10) ? '0' + minutes : minutes); // correct low values
    hours = ((hours < 10) ? '0' + hours : hours); // correct low values
    day = ((day < 10) ? '0' + day : day); // correct low values
    month = ((month < 10) ? '0' + month : month); // correct low values

    return day + '.' + month + '.' + date.getFullYear() + ' ' + hours + ':' + minutes + ':' + seconds;
};

/**
 * Creates logs for users
 */
const createLogs = async () => {
    try {

        let users = await query('SELECT akey FROM accounts');
        users = users.map(user => user.akey);

        for (const user of users) {
            try {
                let lastLog = ((await query('SELECT end FROM logs WHERE akey=? ORDER BY end DESC LIMIT 1', [user]))[0] || {}).end || 0;

                /**
                 * TODO:
                 * - prevent to early logs (check timestamp ?!)
                 */
                let stats = await query('SELECT * FROM statistics WHERE akey=? AND timestamp > ? AND charging IS NOT NULL ORDER BY timestamp', [user, lastLog]);
                let start;
                let end;

                for (const [idX, stat] of stats.entries()) {
                    let checked = false;
                    for (const [nextIdX, nextStat] of stats.entries()) {
                        if (!checked && nextIdX > idX) {
                            checked = true;
                            end = nextStat.timestamp;
                            let doubleChecked = false;
                            let moreDataComing = false;
                            for (const [doubleNextIdX, doubleNextStat] of stats.entries()) {
                                if (!doubleChecked && doubleNextIdX > nextIdX) {
                                    moreDataComing = doubleChecked = true;
                                }
                            }
                            // check if next timestamp difference more than 4 hours - or charge type changed - and difference not more than one hour
                            if (nextStat.timestamp - stat.timestamp < 3600 && (nextStat.timestamp >= stat.timestamp + 14400 || parseInt(nextStat.charging) !== parseInt(stat.charging) || !moreDataComing)) {
                                await query('INSERT INTO logs (akey, start, end, charge, title) VALUES (?, ?, ?, ?, ?)', [user, start, end, stat.charging, formatDate(start)]);
                                start = end = 0;
                            } else if (nextStat.timestamp - stat.timestamp > 3600) start = end;
                        } else if (!start) start = nextStat.timestamp;
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
    } catch (err) {
        console.error(err);
    }
    process.exit();
};

createLogs();