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

const UNIQUE_DELAY = 7200; // seconds for 2 hours
const MIN_DRIVING_TIME = 300; // seconds for 5 minutes

/**
 * Creates logs for users
 */
const createLogs = async () => {
    try {
        // TODO there could be a lot of results. Maybe streaming the results is a good idea?
        let lastLogs = await query('SELECT akey,timestamp,charging,gps_speed FROM (SELECT akey, MAX(end) end FROM logs GROUP BY akey) l RIGHT JOIN (SELECT * FROM statistics WHERE charging IS NOT NULL OR gps_speed > 1.3 ORDER BY timestamp) s USING (akey) WHERE s.timestamp>l.end OR l.end IS NULL');
        var userStates = {};
        var inserts = [];
        for (const [idX, row] of lastLogs.entries()) {
            var user = row.akey;
            if (!userStates[user]) {
                userStates[user] = { start: false, last: false, charging: false, driving: false, };
            }
            var state = userStates[user];

            state.charging = parseInt(state.charging) || 0;
            row.charging = ((row.charging != null) ? parseInt(row.charging) : state.charging);
            if (state.start && (row.charging != state.charging || row.timestamp > state.last + UNIQUE_DELAY)) {
                if ((state.driving || state.charging) && state.last - state.start > MIN_DRIVING_TIME) {
                    inserts.push([user, state.start, state.last, state.charging, formatDate(state.start)]);
                }
                state = userStates[user] = { start: false, last: false, charging: false, driving: false, };
            }
            if (!state.start) {
                state.start = row.timestamp;
                state.charging = ((row.charging != null) ? row.charging : 1);
            }
            state.last = row.timestamp;
            state.driving |= row.gps_speed && row.gps_speed > 1.389;
        }
        Object.keys(userStates).forEach(key => {
            if (!userStates.hasOwnProperty(key)) return;
            var state = userStates[key];
            if (state.last > new Date().getTime() / 1000 - UNIQUE_DELAY) return;
            if ((state.driving || state.charging) && state.last - state.start > MIN_DRIVING_TIME) {
                inserts.push([key, state.start, state.last, state.charging, formatDate(state.start)]);
            }
        });
        // TODO batch insert instead of many singles, but current mysql library does not seem to support them
        var insertPromises = inserts.map(insert => query('INSERT INTO logs (akey, start, end, charge, title) VALUES (?,?,?,?,?)', insert));
        await Promise.all(insertPromises);
    } catch (err) {
        console.error(err);
    }
    process.exit();
};

createLogs();