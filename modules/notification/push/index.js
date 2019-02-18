/**
 * @file modules/notification/push/index.js
 * @author GPlay97
 * @description Push module based on firebase
 */
const srv_config = require('./../../../srv_config.json');
const firebase = require('firebase-admin');
const firebaseFile = ((srv_config.FIREBASE_FILE) ? require(srv_config.FIREBASE_FILE) : null);
const translation = require('./../../translation');

/**
 * Sends push notification
 * @param {Object} userObj the user object
 * @param {Boolean} abort if charging interrupted
 */
const sendPush = (userObj, abort) => {
    if (firebaseFile && srv_config.FIREBASE_URL) {
        const SOC_DISPLAY = (parseFloat(userObj.soc_display) || 0).toString() + '%';
        const SOC_BMS = (parseFloat(userObj.soc_bms) || 0).toString() + '%'; // use string for string replacement within translation
        const textObj = {
            SOC: ((userObj.soc_display == null) ? SOC_BMS : SOC_DISPLAY)
        };
        // send out notification
        firebase.messaging().send({
            android: {
                ttl: 3600 * 6000, // 6 hours
                priority: ((abort) ? 'high' : 'normal'),
                notification: {
                    title: translation.translateWithData(((abort) ? 'PUSH_SOC_ABORT_TITLE' : 'PUSH_SOC_TITLE'), userObj.lng, textObj, true),
                    body: translation.translateWithData(((abort) ? 'PUSH_SOC_ABORT' : 'PUSH_SOC_TEXT'), userObj.lng, textObj, true),
                    color: '#f45342'
                }
            },
            topic: userObj.token
        }).then().catch(err => console.log(err));
    }
};

/**
 * Initializes firebase push notification
 */
const init = () => {
    if (firebaseFile && srv_config.FIREBASE_URL) {
        firebase.initializeApp({
            credential: firebase.credential.cert(firebaseFile),
            databaseURL: srv_config.FIREBASE_URL
        });
    }
};

module.exports = {
    init,
    sendPush
};