/**
 * @file modules/stations/index.js
 * @author GPlay97
 * @description Stations module to interact with GoingElectric API
 */

const srv_config = require('./../../srv_config.json');
const srv_errors = require('./../../srv_errors.json');
const request = require('request');

/**
 * Get charging stations from API
 * @param {Object} coords Object containing latitude and longitude
 * @param {Object} filter optional filter to apply (e.g. radius)
 * @param {Function} callback callback function
 */
const getStations = (coords, filter, callback) => {
    request({
        uri: srv_config.GE_API_URL + '/chargepoints/' + srv_config.GE_API_KEY + '&lat=' +
            coords.lat + '&lng=' + coords.lng + '&radius=' + ((filter.radius) ? filter.radius : 10) +
            '&orderby=distance',
        method: 'GET',
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, (err, resp, body) => {
        try {
            callback(err, ((!err && body) ? JSON.parse(body).chargelocations : null));
        } catch (e) {
            callback(e);
        }
    });
};

/**
 * Retrieves station details for given station id from API
 * @param {Number} id the station id
 * @param {Function} callback callback function
 */
const getStation = (id, callback) => {
    request({
        uri: srv_config.GE_API_URL + '/chargepoints/' + srv_config.GE_API_KEY + '&ge_id=' + id,
        method: 'GET',
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, (err, resp, body) => {
        try {
            callback(err, ((!err && body) ? JSON.parse(body).chargelocations[0] : null));
        } catch (e) {
            callback(e);
        }
    });
};

/**
 * Retrieves station photo for given photo id from API (and streams the image)
 * @param {Number} id the photo id
 * @param {Object} res the server request
 */
const getStationPhoto = (id, res) => {
    request({
        uri: srv_config.GE_API_URL + '/chargepoints/photo/' + srv_config.GE_API_KEY + '&id=' + id,
        method: 'GET',
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10,
        headers: {
            'content-type': 'image/jpeg'
        }
    }).pipe(res);
};

/**
 * Retrieves station cards from API
 * @param {Function} callback callback function
 */
const getStationCards = callback => {
    request({
        uri: srv_config.GE_API_URL + '/chargepoints/chargecardlist/' + srv_config.GE_API_KEY,
        method: 'GET',
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, (err, resp, body) => {
        try {
            callback(err, ((!err && body)? JSON.parse(body).result : null));
        } catch (e) {
            callback(e);
        }
    });
};

module.exports = {
    /**
     * getStations request handler
     * @param {Object} req the server request
     * @param {Object} res the server request
     */
    getStations: (req, res) => {
        const coords = {
            lat: parseFloat(req.query.lat),
            lng: parseFloat(req.query.lng)
        };

        // TODO: validate if number
        if (coords.lat && coords.lng) {
            getStations(coords, {
                radius: parseInt(req.query.radius)
            }, (err, stations) => {
                if (!err && stations) {
                    res.json(stations);
                } else {
                    res.status(422).json({
                        error: srv_errors.UNPROCESSABLE_ENTITY,
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            });
        } else {
            res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
    },
    /**
     * getStation request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getStation: (req, res) => {
        // check params TODO: validate if number
        if (req.query.id) {
            getStation(req.query.id, (err, station) => {
                if (!err && station) {
                    res.json(station);
                } else {
                    res.status(422).json({
                        error: srv_errors.UNPROCESSABLE_ENTITY,
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            });
        } else {
            res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
    },
    /**
     * getStationPhoto request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getStationPhoto: (req, res) => {
        // check params TODO: validate if number
        if (req.query.id) {
            getStationPhoto(req.query.id, res);
        } else {
            res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
    },
    /**
     * getStationCards request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getStationCards: (req, res) => {
        getStationCards((err, cards) => {
            if (!err && cards) {
                res.json(cards);
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};