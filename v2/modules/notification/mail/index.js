/**
 * @file modules/notification/mail/index.js
 * @author GPlay97
 * @description Mail notification module
 */
const nodemailer = require('nodemailer'),
    srv_config = require('./../../../srv_config.json'),
    encryption = require('./../../encryption'),
    translation = require('./../../translation');

const transporter = ((!srv_config.MAIL_SERVICE ||
        !srv_config.MAIL_USER || !srv_config.MAIL_PASSWORD || !srv.config.MAIL_ADDRESS) ? null :
    nodemailer.createTransport({
        service: srv_config.MAIL_SERVICE,
        auth: {
            user: srv_config.MAIL_USER,
            pass: srv_config.MAIL_PASSWORD
        }
    })
);

const validateMail = (mail) => {
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(mail);
};

const sendMail = (mail, lng, car, soc, consumption, abort) => {
    // first check if mail service is available
    if (!transporter) return;
    mail = encryption.decrypt(mail); // decrypted mail
    soc = (parseFloat(soc) || 0).toString(); // use string for string replacement within translation
    // validate mail
    if (validateMail(mail)) {
        transporter.sendMail({
            from: srv_config.MAIL_ADDRESS,
            to: mail,
            subject: translation.translateWithData('MAIL_SUBJECT', lng, {
                SOC: soc
            }, true),
            text: translation.translateWithData('MAIL_SOC_TEXT', lng, {
                SOC: soc,
                RANGE: 0 // TODO
            })
        }, err => {
            if (err) console.error(err);
        });
    }
};

module.exports = {
    validateMail,
    sendMail
};