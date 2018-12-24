/**
 * @file modules/qr/index.js
 * @author GPlay97
 * @description Module for QR code functions
 */
const crypto = require('crypto');
const fs = require('fs');
const qrcode = require('qrcode');
const db = require('./../db');
const token = require('./../token');
const mail = require('./../notification/mail');
const srv_config = require('./../../srv_config.json');
const srv_errors = require('./../../srv_errors.json');

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

const deleteQR = (akey, callback) => db.query('DELETE FROM qr WHERE akey=?', [akey], (err, dbRes) => callback(err, (!err && dbRes)));

const getQR = (akey, callback) => {
    db.query('SELECT code FROM qr WHERE akey=?', [akey], (err, dbRes) => callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0].code : null)));
};

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

const qrStatus = (code, callback) => {
    db.query('SELECT soc_display, soc_bms, last_soc, charging, dc_battery_power FROM sync INNER JOIN qr ON qr.akey=sync.akey WHERE code=?', [
        code
    ], (err, dbRes) => {
        callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0] : null));
    });
};

module.exports = {
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
    qrStatus: (req, res) => {
        if (!req.query.code) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        qrStatus(req.query.code, (err, codeObj) => {
            if (!err && codeObj) {
                res.json(codeObj);
            } else {
                res.status(((err) ? 422 : 404)).json({
                    error: ((err) ? srv_errors.UNPROCESSABLE_ENTITY : srv_errors.NOT_FOUND),
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};