var express = require('express'),
    app = express(),
    srv_config = require('./../../srv_config.json'),
    TelegramBot = require('node-telegram-bot-api'),
    mysql = require('mysql'),
    bot = new TelegramBot(srv_config.TELEGRAM_TOKEN, {polling: true}),
    opts = {reply_markup: JSON.stringify({force_reply: true})};
    db = mysql.createConnection({
        host     : srv_config.DB_HOST,
        user     : srv_config.DB_USER,
        password : srv_config.DB_PW,
        database : srv_config.DB_DB
    });;

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
    } else callback('Unknown user', false);
}

/**
 * Function which starts the telegram bot and listen for incoming messages
 */
exports.startBot = function() {
    // help listener
    bot.onText(/\/help/, function(msg, match) {
        bot.sendMessage(msg.chat.id, 'TELEGRAM_HELP_TEXT'); // translate later
    });

    // subscribe listener
    bot.onText(/\/subscribe/, function(msg, match) {
        var chatID = msg.chat.id;

        // ask for token and add subscribtion for the account
        bot.sendMessage(chatID, 'TELEGRAM_TOKEN_ENTER', opts).then(function(sent) {
            bot.onReplyToMessage(chatID, sent.message_id, function(response) {
                addSubscribtion(chatID, response.text, function(err, subscribed) {
                    if(!err && subscribed) bot.sendMessage(chatID, 'TELEGRAM_SUBSCRIBTION_SUCCESSFULL');
                    else bot.sendMessage(chatID, 'TELEGRAM_SUBSCRIBTION_FAILED');
                });
            });
        });
    });

    // unsubscribe listener
    bot.onText(/\/unsubscribe/, function(msg, match) {
        var chatID = msg.chat.id;

        removeSubscribtion(chatID, function(err, unsubscribed) {
            if(!err && unsubscribed) bot.sendMessage(chatID, 'TELEGRAM_UNSUBSCRIBTION_SUCCESSFULL');
            else bot.sendMessage(chatID, 'TELEGRAM_UNSUBSCRIBTION_FAILED');
        });
    });
};

exports.sendMessage = function(userID, lng) {
    bot.sendMessage(userID, 'TELEGRAM_NOTIFICATION_MESSAGE');
};
