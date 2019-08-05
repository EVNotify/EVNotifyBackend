const request = require('request');
const srv_config = require('../../../srv_config.json');

const db = require('../../db');
const token = require('../../token');

const cars = {
    IONIQ_BEV: 'hyundai:ioniq:17:28:other',
    KONA_EV: 'hyundai:kona:19:64:other',
    ZOE_Q210: 'renault:zoe:q210:22:other'
};

const auth = (req, res, next) => {
    if (!req.query.code) {
        // missing params
        res.json('Missing code');
    }
    token.validateToken(req.params.akey, req.params.token, (err, valid) => {
        if (!err && valid) {
            db.query('UPDATE settings SET abrp=? WHERE akey=?', [
                req.query.code, req.params.akey
            ], (err) => {
                if (!err) {
                    res.json({
                        message: 'Successfully connected. That\'s it. Your data will now be transfered automatically.'
                    });
                } else {
                    res.json(err);
                }
            });
        } else {
            res.json(err || 'unauthorized');
        }
    });
};

const getToken = (code, callback) => {
    request.get(`${srv_config.ABRP_URL}/token?client_id=${srv_config.ABRP_CLIENT_ID}&client_secret=${srv_config.ABRP_CLIENT_SECRET}&code=${code}`, {
        json: true
    }, (err, resp, body) => {
        if (!err && body && body.access_token) {
            callback(null, body.access_token);
        } else {
            callback(err || 'unauthorized');
        }
    });
};

const sendData = (accessToken, abrpData) => {
    // send data
    request.get(`${srv_config.ABRP_API_URL}/send?token=${accessToken}&api_key=${srv_config.ABRP_CLIENT_SECRET}&tlm=${JSON.stringify(abrpData)}`, {
        json: true
    }, (err) => {
        if (err) console.error(err);
    });
};

const submitData = (akey) => {
    // get car and abrp and sync data from user
    db.query('SELECT car, abrp, abrp_token, soc_display, soc_bms, gps_speed, latitude, longitude, charging, dc_battery_power, soh, \
        battery_min_temperature, dc_battery_voltage, dc_battery_current FROM sync INNER JOIN settings ON settings.akey=sync.akey WHERE settings.akey=?', [
        akey
    ], (err, dbRes) => {
        let data;

        if (!err && dbRes && (data = dbRes[0])) {
            if (data.abrp && cars[data.car] && (data.soc_display || data.soc_bms)) {
                const abrpData = {
                    utc: new Date() / 1000,
                    soc: data.soc_display || data.soc_bms,
                    speed: data.gps_speed,
                    lat: data.latitude,
                    lon: data.longitude,
                    is_charging: data.charging,
                    car_model: cars[data.car],
                    power: data.dc_battery_power,
                    soh: data.soh,
                    batt_temp: data.battery_min_temperature,
                    voltage: data.dc_battery_voltage,
                    current: data.dc_battery_current
                };

                if (!data.abrp_token) {
                    getToken(data.abrp, (err, accessToken) => {
                        if (!err && accessToken) {
                            sendData(accessToken, abrpData);
                            db.query('UPDATE settings SET abrp_token=? WHERE akey=?', [accessToken, akey]);
                        }
                    });
                } else {
                    sendData(data.abrp_token, abrpData);
                }
            }
        }
    });
};

module.exports = {
    auth,
    submitData
};
