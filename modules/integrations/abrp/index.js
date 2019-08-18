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

const adjustSOC = (akey, accessToken) => {
    request.get(`${srv_config.ABRP_API_URL}/get_next_charge?token=${accessToken}&api_key=${srv_config.ABRP_CLIENT_SECRET}`, {
        json: true
    }, (err, resp, body) => {
        if (err) console.error(err);
        if (body && body.result && body.result.next_charge) db.query('UPDATE settings SET soc=? WHERE akey=?', [body.result.next_charge, akey]);
    });
};

const submitData = (akey) => {
    // get car and abrp and sync data from user
    db.query('SELECT last_soc, last_location, car, abrp, abrp_token, auto_soc, soc_display, soc_bms, gps_speed, latitude, longitude, charging, dc_battery_power, soh, \
        battery_min_temperature, external_temperature, dc_battery_voltage, dc_battery_current FROM sync INNER JOIN settings ON settings.akey=sync.akey WHERE settings.akey=?', [
        akey
    ], (err, dbRes) => {
        let data;
        const now = parseInt(new Date() / 1000);

        if (!err && dbRes && (data = dbRes[0])) {
            const socUpToDate = now < data.last_soc + 30;
            const locationUpToDate = now < data.last_location + 30;
            
            if (data.abrp && cars[data.car] && (data.soc_display || data.soc_bms) && socUpToDate) {
                const abrpData = {
                    utc: new Date() / 1000,
                    soc: data.soc_display || data.soc_bms,
                    speed: locationUpToDate ? data.gps_speed * 3.6 || null : null,
                    lat: locationUpToDate ? data.latitude : null,
                    lon: locationUpToDate ? data.longitude : null,
                    is_charging: data.charging,
                    car_model: cars[data.car],
                    power: data.dc_battery_power,
                    soh: data.soh,
                    batt_temp: data.battery_min_temperature,
                    ext_temp: data.external_temperature,
                    voltage: data.dc_battery_voltage,
                    current: data.dc_battery_current
                };

                if (!data.abrp_token) {
                    getToken(data.abrp, (err, accessToken) => {
                        if (!err && accessToken) {
                            sendData(accessToken, abrpData);
                            if (data.auto_soc) adjustSOC(akey, accessToken);
                            db.query('UPDATE settings SET abrp_token=? WHERE akey=?', [accessToken, akey]);
                        }
                    });
                } else {
                    sendData(data.abrp_token, abrpData);
                    if (data.auto_soc) adjustSOC(akey, data.abrp_token);
                }
            }
        }
    });
};

module.exports = {
    auth,
    submitData
};
