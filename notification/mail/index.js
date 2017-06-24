var express = require('express'),
    app = express(),
    nodemailer = require('nodemailer'),
    encryption = require('./../../encryption/'),
    srv_config = require('./../../srv_config.json');

/**
 * Function whichs validates a given mail adress
 * @param  {String} email   the mail adress to validate
 * @return {Boolean}        returns whether or not the mail adress is valid
 */
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

/**
 * Function which sends mail to specified mail adress
 * @param  {String} mail    the mail adress from the account
 * @param  {String} lng     the specified language
 */
exports.sendMail = function(mail, lng) {
    // decrypt and validate mail
    if(validateEmail(encryption.decrypt(mail))) {
        var mailTransporter = nodemailer.createTransport({
                service: srv_config.MAIL_SERVICE,
                auth: {
                    user: srv_config.MAIL_USER,
                    pass: srv_config.MAIL_PASSWORD
                }
            }),
            mailOptions = {
                from: srv_config.MAIL_ADRESS,
                to: encryption.decrypt(mail),
                subject: 'EVNOTIFY_MAIL_SUBJECT',   // will be translated later
                text: 'EVNOTIFY_MAIL_TEXT'
            };

        mailTransporter.sendMail(mailOptions, function(err, mailInfo) {
            if(err) return console.log(err);
            console.log('Message %s sent: %s', info.messageId, info.response);
        });
    }
};
