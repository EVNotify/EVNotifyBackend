var express = require('express'),
    app = express(),
    srv_config = require('./../../srv_config.json'),
    TelegramBot = require('node-telegram-bot-api'),
    mysql = require('mysql'),
    language = require('./../../translation/'),
    helper = require('./../../helper'),
    bot = ((!srv_config.TELEGRAM_TOKEN)? false : new TelegramBot(srv_config.TELEGRAM_TOKEN, {polling: true})),
    opts = {reply_markup: JSON.stringify({force_reply: true})};
    db = require('./../../db/').getPool();

/**
 * Function whichs registers the telegram user id for the account so user will receive notifications in future
 * @param {Integer}   userID    the telegram user id to subscribe
 * @param {String}   token      the account token
 * @param {Function} callback   callback function
 */
function addSubscribtion(userID, token, callback) {
    var sql = mysql.format('SELECT token FROM accounts WHERE token=?', [token]);

    // validate token
    db.query(sql, function(err, queryRes) {
        if(!err && queryRes && queryRes[0] && queryRes[0].token === token) {
            var sql = mysql.format('UPDATE settings INNER JOIN accounts ON accounts.akey=settings.akey SET telegram=? WHERE token=?', [userID, token]);

            // register telegram user id
            db.query(sql, function(err, queryRes) {
                callback(err, ((err)? false : true));
            });
        } else callback(err, false);
    });
}

/**
 * Function which unlinks a telegram user so user will no longer receive notifications
 * @param  {Integer}   userID   the telegram user id to unsubscribe
 * @param  {Function} callback  callback function
 */
function removeSubscribtion(userID, callback) {
    if(userID) {
        var sql = mysql.format('UPDATE settings INNER JOIN accounts ON accounts.akey=settings.akey SET telegram=0 WHERE telegram=?', [userID]);

        db.query(sql, function(err, queryRes) {
            callback(err, ((err)? false : true));
        });
    } else callback('Missing user', false);
}

/**
 * Function which fetches information about last submitted current state of charge
 * to inform user about it.
 * NOTE: requires autoSync property turned on
 * @param  {Integer}   userID   the telegram user id to get the current state of charge
 * @param  {Function} callback  callback function
 */
function getCurSoC(userID, akey, callback) {
    if(userID) {
        var sqlCMD = 'SELECT autoSync, curSoC, lastSoC, consumption, lng FROM settings INNER JOIN accounts ON accounts.akey=settings.akey \
            INNER JOIN stats ON accounts.akey=stats.akey WHERE telegram=?' + ((akey)? ' AND accounts.akey=?' : ''),
            sql = mysql.format(sqlCMD, ((akey)? [userID, akey] : [userID]));

        db.query(sql, function(err, queryRes) {
            if(!err && queryRes && queryRes[0]) {
                var syncEnabled = ((queryRes[0].autoSync)? true : false);   // determine if sync enabled to inform user and return curSoc or error

                callback(((syncEnabled)? null : 'Sync not enabled'), ((syncEnabled)? queryRes[0] : false));
            } else callback(err, false);
        });
    } else callback('Missing user', false);
}

/**
 * Function which sends state of charge message to user
 * NOTE: It will send the current state of charge to user only, if autoSync has been enabled.
 * Else, user will be informed, that autoSync is not enabled
 * @param  {Number} chatID  the chat / user id (telegram user id) to send the state of charge message
 * @param  {String} [akey]  optional account key to retrieve the state of charge for, if more than one account linked to Telegram
 *                          NOTE: User can only fetch it's own state of charge from own accounts
 * @return {void}
 */
function sendSoCMessage(chatID, akey) {
    getCurSoC(chatID, akey, function(err, socObj) {
        if(!err && socObj) {
            bot.sendMessage(chatID, language.translateWithData('TELEGRAM_SOC', socObj.lng, {
                SOC:socObj.curSoC, TIME: helper.unixToTimeString(socObj.lastSoC), RANGE: helper.calculateEstimatedRange(socObj.curSoC, socObj.consumption)
            }, true));
        } else bot.sendMessage(chatID, language.translate('TELEGRAM_SOC_ERROR', ((socObj)? socObj.lng : 'en'), true));
    });
}

/**
 * Function which starts the telegram bot and listen for incoming messages
 */
exports.startBot = function() {
    if(bot) {
        // start listener
        bot.onText(/\/start\W*(\w+)?/i, function(msg, match) {
            var lng = match[1] || 'en';
            bot.sendMessage(msg.chat.id, language.translate('TELEGRAM_START_TEXT', lng, true));
        });

        // help listener
        bot.onText(/\/help\W*(\w+)?/i, function(msg, match) {
            var lng = match[1] || 'en';
            bot.sendMessage(msg.chat.id, language.translate('TELEGRAM_HELP_TEXT', lng, true));
        });

        // subscribe listener
        bot.onText(/\/subscribe/, function(msg, match) {
            var chatID = msg.chat.id;

            // ask for token and add subscribtion for the account
            bot.sendMessage(chatID, language.translate('TELEGRAM_TOKEN_ENTER', 'en'), opts).then(function(sent) {
                bot.onReplyToMessage(chatID, sent.message_id, function(response) {
                    addSubscribtion(chatID, response.text, function(err, subscribed) {
                        if(!err && subscribed) bot.sendMessage(chatID, language.translate('TELEGRAM_SUBSCRIBTION_SUCCESSFULL', 'en'));
                        else bot.sendMessage(chatID, language.translate('TELEGRAM_SUBSCRIBTION_FAILED', 'en'));
                    });
                });
            });
        });

        // unsubscribe listener
        bot.onText(/\/unsubscribe/, function(msg, match) {
            var chatID = msg.chat.id;

            removeSubscribtion(chatID, function(err, unsubscribed) {
                if(!err && unsubscribed) bot.sendMessage(chatID, language.translate('TELEGRAM_UNSUBSCRIBTION_SUCCESSFULL', 'en'));
                else bot.sendMessage(chatID, language.translate('TELEGRAM_UNSUBSCRIBTION_FAILED', 'en'));
            });
        });

        // current soc listener
        bot.onText(/\/soc/, function(msg, match) {
            if(match.input === '/soc') sendSoCMessage(msg.chat.id); // only listen for direct /soc commands
        });
        // soc listener for specific connected akey
        bot.onText(/\/soc (.+)/, function(msg, match) {
            sendSoCMessage(msg.chat.id, match[1]);
        });
        // soc listener text based messages
        bot.onText(/ladezustand/i, function(msg, match) {
            sendSoCMessage(msg.chat.id);
        });
        bot.onText(/state of charge/i, function(msg, match) {
            sendSoCMessage(msg.chat.id);
        });
        bot.onText(/reichweite/i, function(msg, match) {
            sendSoCMessage(msg.chat.id);
        });
        bot.onText(/range/i, function(msg, match) {
            sendSoCMessage(msg.chat.id);
        });
    }
};

/**
 * Function which sends message to specified user id
 * @param  {Integer} userID the user id
 * @param  {String} lng     the language to use for the notification
 * @param  {Number} curSoC  the current state of charge, which will be attached as info within mail (with calculated range)
 * @param  {Number} consumption the consumption value to use for range calculation
 * @param  {Boolean} error  whether or not an error occured so we should inform the user
 *                          if this param is not set/false, the success notification will be sent
 */
exports.sendMessage = function(userID, lng, curSoC, consumption, error) {
    if(bot) {
        curSoC = parseInt(curSoC || 0).toString(); // use string for string replacement within translation

        bot.sendMessage(userID,
            ((error)? 
                language.translateWithData('TELEGRAM_NOTIFICATION_ERROR_MESSAGE', lng, {SOC: curSoC}, true) : 
                language.translateWithData('TELEGRAM_NOTIFICATION_MESSAGE', lng, {SOC: curSoC, RANGE: helper.calculateEstimatedRange(parseInt(curSoC), consumption)}, true))
        );
    }
};

/**
 * Sends summary message to specified telegram account (e.g. for cron job)
 * @param {Number} telegramID the telegram user id
 * @param {String} akey the user account id
 */
exports.sendSummary = function(telegramID, akey) {
    if(bot) sendSoCMessage(telegramID, akey);
};
