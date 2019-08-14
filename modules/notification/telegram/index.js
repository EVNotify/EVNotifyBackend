/**
 * @file modules/notification/telegram/index.js
 * @author GPlay97
 * @description Telegram notification module
 */
const srv_config = require('./../../../srv_config.json'),
    TelegramBot = require('node-telegram-bot-api'),
    bot = ((srv_config.TELEGRAM_TOKEN) ? new TelegramBot(srv_config.TELEGRAM_TOKEN, {
        polling: true
    }) : false),
    db = require('./../../db'),
    helper = require('./../../helper'),
    translation = require('./../../translation');

/**
 * 
 * @param {Number} userID the Telegram user id
 * @param {Function} callback callback function
 */
const getUserLng = (userID, callback) => {
    db.query('SELECT lng FROM settings WHERE telegram=?', [
        userID
    ], (err, dbRes) => callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0].lng : null)));
};

/**
 * Adds subscribtion to account for given token
 * @param {Number} userID the Telegram user id
 * @param {String} token the account token
 * @param {Function} callback callback function
 */
const addSubscribtion = (userID, token, callback) => {
    // retrieve token and akey to validate token
    db.query('SELECT akey, token FROM accounts WHERE token=?', [
        token
    ], (err, userRes) => {
        if (!err && userRes && userRes[0] && userRes[0].token === token) {
            // link Telegram to account
            db.query('UPDATE settings SET telegram=? WHERE akey=?', [
                userID, userRes[0].akey
            ], (err, updRes) => callback(err, updRes));
        } else callback(err);
    });
};

/**
 * Removes subscribtion for given user
 * @param {Number} userID the Telegram user id
 * @param {Function} callback callback function
 */
const removeSubscribtion = (userID, callback) => {
    db.query('UPDATE settings SET telegram=0 WHERE telegram=?', [
        userID
    ], (err, updRes) => callback(err, updRes));
};

/**
 * Sends the current soc message
 * @param {Number} userID the Telegram user id
 * @param {String} [akey] optional akey to retrieve soc for
 */
const sendSoCMessage = (userID, akey) => {
    // retrieve the current state of charge
    db.query('SELECT accounts.akey, car, lng, soc_display, soc_bms, consumption, last_notification FROM accounts \
        INNER JOIN sync ON accounts.akey=sync.akey INNER JOIN settings ON settings.akey=accounts.akey \
        WHERE settings.telegram=? ' + ((akey) ? 'AND accounts.akey=?' : ''),
        ((akey) ? [userID, akey] : [userID]), (err, userRes) => {
            const userObj = ((!err && userRes) ? userRes[0] : null);

            if (!err && userObj != null) {
                const SOC_DISPLAY = (parseFloat(userObj.soc_display) || 0).toString() + '%',
                    SOC_BMS = (parseFloat(userObj.soc_bms) || 0).toString() + '%'; // use string for string replacement within translation

                bot.sendMessage(userID, translation.translateWithData('TELEGRAM_SOC', userObj.lng, {
                    SOC: ((userObj.soc_display == null) ? SOC_BMS : ((
                            userObj.soc_bms == null) ?
                        SOC_DISPLAY : SOC_DISPLAY)),
                    RANGE: helper.calculateRange(userObj.car, userObj.soc_display || userObj.soc_bms, userObj.consumption) + 'km'
                }, true));
            } else bot.sendMessage(userID, translation.translate('TELEGRAM_SOC_ERROR', ((userObj) ? userObj.lng : 'en'), true));
        });
};

/**
 * Sends the current location
 * @param {Number} userID the telegram user id
 */
const sendLocation = userID => {
    // retrieve the current location
    db.query('SELECT accounts.akey, lng, latitude, longitude FROM accounts INNER JOIN sync ON accounts.akey=sync.akey \
        INNER JOIN settings ON settings.akey=accounts.akey WHERE settings.telegram=?', [userID], (err, userRes) => {
        const userObj = ((!err && userRes) ? userRes[0] : null);

        if (!err && userObj && parseInt(userObj.latitude) && parseInt(userObj.longitude)) {
            bot.sendMessage(userID, translation.translate('TELEGRAM_LOCATION', userObj.lng, true))
                .then(() => {
                    bot.sendLocation(userID, userObj.latitude, userObj.longitude);
                })
                .catch(() => bot.sendMessage(userID, translation.translate('TELEGRAM_LOCATION_ERROR', ((userObj) ? userObj.lng : 'en'), true)));
        } else bot.sendMessage(userID, translation.translate('TELEGRAM_LOCATION_ERROR', ((userObj) ? userObj.lng : 'en'), true));
    });
};

/**
 * Sends extended data
 * @param {Number} userID the telegram user id
 */
const sendExtended = userID => {
    // retrieve extended data
    db.query('SELECT accounts.akey, lng, soh, charging, aux_battery_voltage, dc_battery_voltage, dc_battery_current, dc_battery_power, \
        battery_min_temperature, battery_max_temperature, battery_inlet_temperature FROM accounts \
        INNER JOIN sync ON accounts.akey=sync.akey INNER JOIN settings ON settings.akey=accounts.akey \
        WHERE settings.telegram=?', [userID], (err, userRes) => {
        const userObj = ((!err && userRes) ? userRes[0] : null);

        if (!err && userObj != null) {
            bot.sendMessage(userID, translation.translateWithData('TELEGRAM_EXTENDED', userObj.lng, {
                SOH: String(userObj.soh),
                CHARGING: translation.translate(((userObj.charging) ? 'YES' : 'NO'), userObj.lng, true),
                AUX_BATTERY_VOLTAGE: String(userObj.aux_battery_voltage),
                DC_BATTERY_VOLTAGE: String(userObj.dc_battery_voltage),
                DC_BATTERY_CURRENT: String(userObj.dc_battery_current),
                DC_BATTERY_POWER: String(userObj.dc_battery_power),
                BATTERY_MIN_TEMPERATURE: String(userObj.battery_min_temperature),
                BATTERY_MAX_TEMPERATURE: String(userObj.battery_max_temperature),
                BATTERY_INLET_TEMPERATURE: String(userObj.battery_inlet_temperature)
            }, true));
        } else bot.sendMessage(userID, translation.translate('TELEGRAM_EXTENDED_ERROR', ((userObj) ? userObj.lng : 'en'), true));
    });
};

/**
 * Shorthand to retrieve soc and extended data
 * @param {Number} userID the telegram user id
 */
const sendCombined = userID => {
    sendSoCMessage(userID);
    sendExtended(userID);
};

/**
 * Starts the telegram bot - apply listener and handling for incoming messages
 */
const startBot = () => {
    // if bot, apply listener and handler for incoming messages
    if (bot) {
        // start listener (optional: preferred language)
        bot.onText(/\/start\W*(\w+)?/i, (msg, match) => {
            const lng = match[1] || 'en';

            bot.sendMessage(msg.chat.id, translation.translate('TELEGRAM_START_TEXT', lng, true));
        });
        // help listener (optional: preferred language)
        bot.onText(/\/help\W*(\w+)?/i, (msg, match) => {
            const lng = match[1] || 'en';

            bot.sendMessage(msg.chat.id, translation.translate('TELEGRAM_HELP_TEXT', lng, true));
        });
        // subscribe listener
        bot.onText(/\/subscribe/, msg => {
            const userID = msg.chat.id;

            // get user preferred language
            getUserLng(userID, (err, lng) => {
                if (err) console.error(err);
                // ask for token and add subscribtion for the account
                bot.sendMessage(userID, translation.translate('TELEGRAM_TOKEN_ENTER', lng, true), {
                    reply_markup: JSON.stringify({
                        force_reply: true
                    })
                }).then(sent => {
                    bot.onReplyToMessage(userID, sent.message_id, response => {
                        addSubscribtion(userID, response.text, (err, subscribed) => {
                            if (!err && subscribed) bot.sendMessage(userID, translation.translate('TELEGRAM_SUBSCRIBTION_SUCCESSFULL', lng, true));
                            else bot.sendMessage(userID, translation.translate('TELEGRAM_SUBSCRIBTION_FAILED', lng, true));
                        });
                    });
                });
            });
        });
        // unsubscribe listener
        bot.onText(/\/unsubscribe/, msg => {
            const userID = msg.chat.id;

            // get user preferred language
            getUserLng(userID, (err, lng) => {
                if (err) console.error(err);
                removeSubscribtion(userID, (err, unsubscribed) => {
                    if (!err && unsubscribed) bot.sendMessage(userID, translation.translate('TELEGRAM_UNSUBSCRIBTION_SUCCESSFULL', lng, true));
                    else bot.sendMessage(userID, translation.translate('TELEGRAM_UNSUBSCRIBTION_FAILED', lng, true));
                });
            });
        });
        // soc listener (for optional specific connected AKey)
        bot.onText(/\/soc\W*(\w+)?/i, (msg, match) => sendSoCMessage(msg.chat.id, match[1]));
        // soc listener for text based messages
        bot.onText(/ladezustand/i, msg => sendSoCMessage(msg.chat.id));
        bot.onText(/state of charge/i, msg => sendSoCMessage(msg.chat.id));
        bot.onText(/reichweite/i, msg => sendSoCMessage(msg.chat.id));
        bot.onText(/range/i, msg => sendSoCMessage(msg.chat.id));
        // location listener
        bot.onText(/where/i, msg => sendLocation(msg.chat.id));
        bot.onText(/wo/i, msg => sendLocation(msg.chat.id));
        bot.onText(/location/i, msg => sendLocation(msg.chat.id));
        bot.onText(/standort/i, msg => sendLocation(msg.chat.id));
        // extended data listener
        bot.onText(/extended/i, msg => sendExtended(msg.chat.id));
        bot.onText(/erweitert/i, msg => sendExtended(msg.chat.id));
        // all data listener
        bot.onText(/all/i, msg => sendCombined(msg.chat.id));
        bot.onText(/alle/i, msg => sendCombined(msg.chat.id));
    }
};

/**
 * Sends message to user (abort or soc value reaached)
 * @param {Object} userObj the user object containing information such as lng and state of charge
 * @param {Boolean} [abort] whether or not abort message should be sent out 
 */
const sendMessage = (userObj, abort) => {
    if (bot && userObj != null) {
        const SOC_DISPLAY = (parseFloat(userObj.soc_display) || 0).toString() + '%';
        const SOC_BMS = (parseFloat(userObj.soc_bms) || 0).toString() + '%'; // use string for string replacement within translation

        bot.sendMessage(userObj.telegram, ((abort) ?
            translation.translateWithData('TELEGRAM_NOTIFICATION_ABORT_MESSAGE', userObj.lng, {
                SOC: ((userObj.soc_display == null) ? SOC_BMS : ((
                        userObj.soc_bms == null) ?
                    SOC_DISPLAY : SOC_DISPLAY))
            }, true) :
            translation.translateWithData('TELEGRAM_NOTIFICATION_MESSAGE', userObj.lng, {
                SOC: ((userObj.soc_display == null) ? SOC_BMS : ((
                        userObj.soc_bms == null) ?
                    SOC_DISPLAY : SOC_DISPLAY)),
                RANGE: helper.calculateRange(userObj.car, userObj.soc_display || userObj.soc_bms, userObj.consumption) + 'km'
            }, true)
        ));
    }
}

module.exports = {
    startBot,
    sendMessage
};