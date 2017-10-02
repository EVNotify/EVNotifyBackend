var srv_config = require('./../../srv_config.json'),
    request = require('request');

/**
 * Function which retrieves list of stations based on given position and radius
 * @param  {Object}   latLng    Object containing latitude and longitude property
 * @param  {Integer}   radius   the radius to search for (in kilometres)
 * @param  {Function} callback  callback function
 * @return {void}
 */
function getStations(latLng, radius, callback) {
    request({
        uri: srv_config.STATIONS_API_URL + '&lat=' + latLng.lat + '&lng=' + latLng.lng + '&radius=' + ((radius)? radius : 10) + '&orderby=distance',
        method: 'GET',
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, function(err, resp, body) {
        try {
            callback(err, ((err)? null : JSON.parse(body)));
        } catch (e) {
            callback(500, null);
        }
    });
}

/**
 * getStations request handler
 * @param  {ServerRequest} req  ServerRequest
 * @param  {ServerResponse} res ServerResponse
 * @return {ServerResponse}
 */
exports.getStations = function(req, res) {
    // check params
    if(typeof req.body !== 'undefined' && req.body.lat, req.body.lng) {
        getStations({lat: req.body.lat, lng: req.body.lng}, req.body.radius, function(err, stationRes) {
            res.json({err: err, stations: stationRes});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};
