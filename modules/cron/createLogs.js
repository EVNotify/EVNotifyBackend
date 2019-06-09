/**
 * @file modules/cron/createLogs.js
 * @author GPlay97
 * @description Cron file to create logs for user in background
 */
const http = require('http');
const srv_config = require('./../../srv_config.json');
const db = require('./../db');
const util = require('util');
const query = db.query;
const pquery = util.promisify(query);

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

const UNIQUE_DELAY = 600; // seconds for 10 minutes
const MIN_DRIVING_TIME = 300; // seconds for 5 minutes

/**
 * Creates logs for users
 */
const createLogs = () => {
    return new Promise((res, rej) => {
        // statistics
        var start = new Date().getTime();
        var firstResult;
        var rows = 0;

        var encounteredError = false;
        var userStates = {};
        var inserts = [];
        let queryStream = query('SELECT akey,timestamp,charging,gps_speed FROM (SELECT akey, MAX(end) end FROM logs GROUP BY akey) l RIGHT JOIN (SELECT * FROM statistics WHERE charging IS NOT NULL OR gps_speed > 1.3 ORDER BY timestamp) s USING (akey) WHERE s.timestamp>l.end OR l.end IS NULL');
        queryStream.on('error', function (err) {
            encounteredError = err;
        })
        queryStream.on('result', function (row) {
            firstResult = firstResult || new Date().getTime();
            rows++;
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
        });
        queryStream.on('end', function () {
            if (encounteredError) {
                rej(encounteredError);
            }
            var endBegin = new Date().getTime();
            var now = endBegin / 1000;
            Object.keys(userStates).forEach(key => {
                if (!userStates.hasOwnProperty(key)) return;
                var state = userStates[key];
                if (state.last > now - UNIQUE_DELAY) return;
                if ((state.driving || state.charging) && state.last - state.start > MIN_DRIVING_TIME) {
                    inserts.push([key, state.start, state.last, state.charging, formatDate(state.start)]);
                }
            });
            function createResult(queryResult) {
                return {
                    nWrite: inserts.length,
                    nRead: rows,
                    ttfr: firstResult ? firstResult - start : endBegin - start, // time to first row
                    tfr: firstResult ? endBegin - firstResult : -1, // time for reading
                    tfi: new Date().getTime() - endBegin, // time for insert
                    time: new Date().getTime() - start, // time from beginning
                    queryResult
                };
            }
            if (inserts.length) {
                pquery('INSERT INTO logs (akey, start, end, charge, title) VALUES ?', [inserts])
                        .then(createResult).then(res).catch(rej);
            } else {
                res(createResult());
            }
        });
    });
};

http.createServer().listen(srv_config.CRON_LOG_PORT);

if (require.main === module) {
    createLogs().then(console.log).catch(console.log).then(() => {
        db.close(() => {
            process.exit();
        });
    });
} else {
    exports.createLogs = createLogs;
}