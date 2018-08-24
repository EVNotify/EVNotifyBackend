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
        !srv_config.MAIL_USER || !srv_config.MAIL_PASSWORD || !srv_config.MAIL_ADDRESS) ? null :
    nodemailer.createTransport({
        service: srv_config.MAIL_SERVICE,
        auth: {
            user: srv_config.MAIL_USER,
            pass: srv_config.MAIL_PASSWORD
        }
    })
);

/**
 * Validates mail and returns whether it is valid or not
 * @param {String} mail the mail address to validate
 */
const validateMail = (mail) => {
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(mail);
};

/**
 * Sends mail for given user and its details
 * @param {Object} userObj the user object containing information such as email, lng or soc values
 * @param {Boolean} abort whether or not charge abort notification should be sent out
 */
const sendMail = (userObj, abort) => {
    // first check if mail service is available and if userObj is given
    if (!transporter || userObj == null) return;
    const mail = encryption.decrypt(userObj.email), // decrypted mail
        SOC_DISPLAY = (parseFloat(userObj.soc_display) || 0).toString() + '%',
        SOC_BMS = (parseFloat(userObj.soc_bms) || 0).toString() + '%', // use string for string replacement within translation
        subjectObj = {
            SOC: ((
                userObj.soc_display == null) ? SOC_BMS : ((
                    userObj.soc_bms == null) ?
                SOC_DISPLAY : SOC_DISPLAY))
    
        }, // use only defined values for text
        textObj = {
            SOC: ((
                userObj.soc_display == null) ? '<b>' + SOC_BMS + '</b> (BMS)': ((
                    userObj.soc_bms == null) ?
                '<b>' + SOC_DISPLAY + '</b> (Display)' : '<b>' + SOC_DISPLAY + '</b> (Display) / ' + SOC_BMS + ' (BMS)')),
            RANGE: '0km' // TODO
        };

    // validate mail
    if (validateMail(mail)) {
        transporter.sendMail({
            from: srv_config.MAIL_ADDRESS,
            to: mail,
            subject: translation.translateWithData(((abort) ? 'MAIL_SUBJECT_ABORT' : 'MAIL_SUBJECT'), userObj.lng, subjectObj, true),
            html: translation.translateWithData(((abort) ? 'MAIL_SOC_TEXT_ABORT' : 'MAIL_SOC_TEXT'), userObj.lng, textObj, true)
        }, err => {
            if (err) console.error(err);
        });
    }
};

module.exports = {
    validateMail,
    sendMail
};