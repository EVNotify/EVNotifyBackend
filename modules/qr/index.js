/**
 * @file modules/qr/index.js
 * @author GPlay97
 * @description Module for QR code functions
 */
const crypto = require('crypto');
const fs = require('fs');
const qrcode = require('qrcode');
const db = require('./../db');
const helper = require('./../helper');
const token = require('./../token');
const mail = require('./../notification/mail');
const srv_config = require('./../../srv_config.json');
const srv_errors = require('./../../srv_errors.json');

/**
 * Creates QR code for given akey - checks if already created to prevent new qr code generation
 * @param {String} akey the akey of the account
 * @param {Function} callback callback function
 */
const createQR = (akey, callback) => {
    // check first if qr code already created for account
    getQR(akey, (err, code) => {
        if (!err) {
            if (code) callback(null, code);
            else {
                const code = crypto.randomBytes(6).toString('hex');

                db.query('INSERT INTO qr (code, akey) VALUES (?, ?)', [code, akey], err => callback(err, ((!err) ? code : null)));
            }
        } else callback(err);
    });
};

/**
 * Deletes QR code from given account
 * @param {String} akey the akey of the account
 * @param {Function} callback callback function
 */
const deleteQR = (akey, callback) => db.query('DELETE FROM qr WHERE akey=?', [akey], (err, dbRes) => callback(err, (!err && dbRes)));

/**
 * Retrieves generated qr code of the given akey
 * @param {String} akey the akey of the account
 * @param {Function} callback callback function
 */
const getQR = (akey, callback) => {
    db.query('SELECT code FROM qr WHERE akey=?', [akey], (err, dbRes) => callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0].code : null)));
};

/**
 * Resolves qr code from given akey and sends the qr code image to given mail
 * @param {String} akey the akey of the account
 * @param {String} email the mail to send the qr code to
 * @param {Function} callback callback function
 */
const sendQR = (akey, email, callback) => {
    // resolve code from akey
    getQR(akey, (err, code) => {
        if (!err && code) {
            // create random tmp file
            const tmpFile = crypto.randomBytes(24).toString('hex') + '.png';

            // generate qr code
            qrcode.toFile(tmpFile, 'https://qr.evnotify.de?code=' + code, {
                errorCorrectionLevel: 'H'
            }, err => {
                if (!err) {
                    // send mail
                    mail.simpleSend(email, 'EVNotify QR Code', 'EVNotify QR Code', [{
                        filename: 'QR.png',
                        path: tmpFile
                    }], err => {
                        // unlink file
                        fs.unlink(tmpFile, err => {
                            if (err) console.error(err);
                        });
                        callback(err);
                    });
                } else callback(err);
            });
        } else callback(err);
    });
};

/**
 * Resolves information from given qr code to retrieve data such as charging information
 * @param {String} code the qr code to retrieve information from
 * @param {Function} callback callback function
 */
const qrStatus = (code, callback) => {
    db.query('SELECT car, soc_display, soc_bms, last_soc, capacity, charging, dc_battery_power, slow_charge_port, normal_charge_port, rapid_charge_port FROM sync INNER JOIN qr ON qr.akey=sync.akey INNER JOIN settings ON settings.akey=qr.akey WHERE code=?', [
        code
    ], (err, dbRes) => {
        callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0] : null));
    });
};

module.exports = {
    /**
     * createQR request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    createQR: (req, res) => {
        if (!req.body.akey || !req.body.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    createQR(req.body.akey, (err, code) => {
                        if (!err && code) {
                            res.json(code);
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * deleteQR request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    deleteQR: (req, res) => {
        if (!req.body.akey || !req.body.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    deleteQR(req.body.akey, (err, deleted) => {
                        if (!err && deleted) {
                            res.json({
                                deleted
                            });
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * sendQR request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    sendQR: (req, res) => {
        if (!req.body.akey || !req.body.token || !mail.validateMail(req.body.email)) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    sendQR(req.body.akey, req.body.email, (err, sent) => {
                        if (!err) {
                            res.json({
                                sent
                            });
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * qrStatus request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    qrStatus: (req, res) => {
        if (!req.query.code) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        qrStatus(req.query.code, (err, codeObj) => {
            if (!err && codeObj) {
                // prevent access if not charging or data is to old (older than 10 minutes)
                if (!codeObj.charging || (Date.now() / 1000 - 600) > codeObj.last_soc) {
                    res.status(401).json({
                        error: srv_errors.ACCESS_DENIED,
                        debug: ((srv_config.DEBUG) ? codeObj : null)
                    });
                } else {
                    // calculate estimated time
                    codeObj.estimatedTime = helper.calculateTime(
                        codeObj.car,
                        (codeObj.soc_bms || codeObj.soc_display),
                        codeObj.charging,
                        ((codeObj.slow_charge_port) ? 'slow_charge_port' : ((codeObj.normal_charge_port) ? 'normal_charge_port' : ((codeObj.rapid_charge_port) ? 'rapid_charge_port' : null))),
                        codeObj.dc_battery_power,
                        codeObj.capacity
                    );
                    res.json(codeObj);
                }
            } else {
                res.status(((err) ? 422 : 404)).json({
                    error: ((err) ? srv_errors.UNPROCESSABLE_ENTITY : srv_errors.NOT_FOUND),
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * qrNotify request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    qrNotify: (req, res) => {
        if (!req.body.code) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        db.query('SELECT sync.akey, last_qr, email, telegram, push FROM sync INNER JOIN qr ON qr.akey=sync.akey INNER JOIN settings ON settings.akey=qr.akey WHERE code=?', [
            req.body.code
        ], (err, dbRes) => {
            let dbObj;

            if (!err && dbRes && (dbObj = dbRes[0])) {
                const now = Math.floor(Date.now() / 1000);

                // valid, compare last_qr timestamp to determine if limit reached
                if ((dbObj.last_qr || 0) + 600 < now) {
                    // send out notifications based on activated types in background
                    if (dbObj.email) mail.sendQRMail(dbObj);
                    res.json({
                        notified: true
                    });
                    // update last_qr
                    db.query('UPDATE sync SET last_qr=? WHERE akey=?', [
                        now, dbObj.akey
                    ]);
                } else {
                    res.setHeader('Retry-After', 600);
                    // too many request
                    res.status(429).json({
                        error: srv_errors.TOO_MANY_REQUESTS,
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            } else {
                res.status(((err) ? 422 : 404)).json({
                    error: ((err) ? srv_errors.UNPROCESSABLE_ENTITY : srv_errors.NOT_FOUND),
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};
