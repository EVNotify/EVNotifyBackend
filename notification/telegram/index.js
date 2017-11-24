var express = require('express'),
    app = express(),
    srv_config = require('./../../srv_config.json'),
    TelegramBot = require('node-telegram-bot-api'),
    mysql = require('mysql'),
    language = require('./../../translation/'),
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
            var sql = mysql.format('UPDATE accounts SET telegram=? WHERE token=?', [userID, token]);

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
        var sql = mysql.format('UPDATE accounts SET telegram=0 WHERE telegram=?', [userID]);

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
        var sqlCMD = 'SELECT autoSync, curSoC, lng FROM accounts WHERE telegram=?' + ((akey)? ' AND akey=?' : ''),
            sql = mysql.format(sqlCMD, ((akey)? [userID, akey] : [userID]));

        db.query(sql, function(err, queryRes) {
            if(!err && queryRes && queryRes[0]) {
                var syncEnabled = ((queryRes[0].autoSync)? true : false);   // determine if sync enabled to inform user and return curSoc or error

                callback(((syncEnabled)? null : 'Sync not enabled'), ((syncEnabled)? queryRes[0] : false));
            } else callback(err, false);
        });
    } else callback('Missing user', false);
}

function sendSoCMessage(chatID, akey) {
    getCurSoC(chatID, akey, function(err, socObj) {
        if(!err && socObj) bot.sendMessage(chatID, language.translate('TELEGRAM_SOC', socObj.lng) + ' ' + socObj.curSoC + '%');
        else bot.sendMessage(chatID, language.translate('TELEGRAM_SOC_ERROR', ((socObj)? socObj.lng : 'en')));
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
    }
};

/**
 * Function which sends message to specified user id
 * @param  {Integer} userID the user id
 * @param  {String} lng     the language to use for the notification
 * @param  {Boolean} error  whether or not an error occured so we should inform the user
 *                          if this param is not set/false, the success notification will be sent
 */
exports.sendMessage = function(userID, lng, error) {
    if(bot) {
        bot.sendMessage(userID,
            ((error)? language.translate('TELEGRAM_NOTIFICATION_ERROR_MESSAGE', lng) : language.translate('TELEGRAM_NOTIFICATION_MESSAGE', lng))
        );
    }
};
