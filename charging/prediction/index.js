/**
 * // TODO
 * // @what?
 * - Script, that analyzes submitted charging states to predict when battery will be full - or empty
 * - therefore it analyzes the last submitted values, considers the timestamps and with an algorithm, it makes a prediction
 * - more data => higher precision
 * // @why?
 * - it's cool, isn't it?
 * - we can analyze the charging behaviour and use this to inform user later? Maybe notification? Send him stations nearby? Would be cool?!
 * // @how?
 * - don't know..
 * - just code
 * - ok, lets think..// DONE
 * - db query to retrieve statistics // DONE
 *  --> max from now - 1 day // DONE
 * - concat the values to each user / group them and sort them! // DONE
 * - determine the direction (charging or not) -> last value larger than previous ones // DONE
 * - then the hard part comes.. - oh yes.. hard.. //DONE
 * - do something cool with it ;-)
 */

const db = require('./../../db').getPool(), // FIXME that's uncool and not working really - make a correct db module soon!
    mysql = require('mysql');

/**
 * Retrieves statistics since yesterday
 * @param {Function} callback callback function
 */
let getStatistics = (callback) => {
    db.query(mysql.format('SELECT akey, value, timestamp FROM statistics WHERE type=? AND timestamp >=?', ['soc', parseInt(new Date() / 1000) - 86400]), (err, dbRes) => callback(err, dbRes));
};

console.time('prediction');
// retrieve the statistics first
getStatistics((err, statsRes) => {
    if (!err && Array.isArray(statsRes)) {
        let users = {};

        statsRes.forEach(statObj => {
            // register user if not registered within object
            if (!users[statObj.akey]) users[statObj.akey] = [];
            // collect and push data to each user
            users[statObj.akey].push({
                value: parseInt(statObj.value) || 0,
                timestamp: parseInt(statObj.timestamp) || 0
            });
        });
        // iterate through each user
        Object.keys(users).forEach(user => {
            let uniqueValues, startValue, isCharging, valuesToInspect, previousValue = 0, proceed = true;

            // sort it locally for each user (type DESC)
            users[user] = users[user].sort((a, b) => {
                if (a.timestamp < b.timestamp) return 1;
                else if (a.timestamp > b.timestamp) return -1;
                return 0;
            });
            // determines if charging (retrieves unique values to determine if previous value after first one greater or not)
            uniqueValues = [...new Set(users[user].map(obj => obj.value))];
            users[user].isCharging = isCharging = ((startValue = uniqueValues[0]) > uniqueValues[1]);

            // filter out only valid values based if charging or not (must be lower than start in consideration of previous value)
            valuesToInspect = users[user].filter(obj => {
                if(isCharging && proceed && previousValue >= obj.value) return proceed = ((previousValue = obj.value) <= startValue);
                else if(proceed && previousValue <= obj.value) return proceed = ((previousValue = obj.value) >= startValue);
            });

            if(valuesToInspect.length) {
                let firstValue = valuesToInspect[0].value,
                    firstTimestamp = valuesToInspect[0].timestamp,
                    lastValue = valuesToInspect[valuesToInspect.length -1].value,
                    lastTimestamp = valuesToInspect[valuesToInspect.length - 1].timestamp,
                    valueDifference, timeDifference, percentageLeft, predicted;
                /**
                 * // TODO
                 * It finally works! Great.
                 * Add some documentation.
                 * And do something with it instead of logging it ;-)
                 */

                console.log({
                    amountOfData: valuesToInspect.length,
                    isCharging,
                    valueDifference: (valueDifference = firstValue - lastValue),
                    timeDifference: (timeDifference = firstTimestamp - lastTimestamp),
                    percentageLeft: (percentageLeft = ((isCharging)? 100 - firstValue : firstValue)),
                    predicted: ((
                        (predicted = new Date((firstTimestamp * 1000) + ( (timeDifference / valueDifference) * percentageLeft )
                    ) instanceof Date && !isNaN(predicted))? predicted.toLocaleString() : new Date(lastTimestamp * 1000).toLocaleString()))
                });
            }
        });
        console.timeEnd('prediction');
        process.exit(1);
    } else process.exit(1);
});