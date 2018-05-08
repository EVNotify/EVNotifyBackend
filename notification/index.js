var express = require('express'),
    app = express(),
    nodemailer = require('nodemailer'),
    bodyParser = require('body-parser'),
    encryption = require('./../encryption/'),
    srv_config = require('./../srv_config.json'),
    mail = require('./mail/'),
    telegram = require('./telegram/'),
    // push = require('./push/'),
    mysql = require('mysql'),
    db = require('./../db/').getPool();

/**
 * notification send handler
 * @param  {ServerRequest} req  server request
 * @param  {ServerResponse} res server response
 */
exports.send = function(req, res) {
    // check required params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.token) {
        // validate token
        var sql = mysql.format('SELECT accounts.akey, curSoC, consumption, email, push, telegram, lng, accounts.token, lastNotification FROM settings \
            INNER JOIN accounts ON accounts.akey=settings.akey INNER JOIN stats ON accounts.akey=stats.akey WHERE accounts.akey=?', [req.body.akey]);

        // check if specified account exists
        db.query(sql, function(err, queryRes) {
            if(!err && queryRes && queryRes[0]) {
                if(queryRes[0].token === req.body.token) {
                    // check if limit already reached (to prevent multiple notifications in short time)
                    if((queryRes[0].lastNotification || 0) + 5 < parseInt(new Date().getTime() / 1000)) {
                        // send notifications in background depending on type
                        if(queryRes[0].email) mail.sendMail(queryRes[0].email, queryRes[0].lng, queryRes[0].curSoC, queryRes[0].consumption, req.body.error);
                        // if(queryRes[0].push) push.sendPush(req.body.akey, queryRes[0].lng, req.body.error);
                        if(queryRes[0].telegram) telegram.sendMessage(queryRes[0].telegram, queryRes[0].lng, queryRes[0].curSoC, queryRes[0].consumption, req.body.error);
                        // let the notifications proceed in background, inform user
                        res.json({message: 'Notifications successfully sent'});
                        // update last notification timestamp
                        db.query(mysql.format('UPDATE stats SET lastNotification=? WHERE akey=?', [parseInt(new Date().getTime() / 1000), req.body.akey]));
                    } else res.status(429).json({message: 'Too many notifications requests. Try again in a few seconds', error: 429});
                } else res.status(401).json({message: 'Unauthorized', error: 401});
            } else res.status(401).json({message: 'Unauthorized', error: 401});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};
