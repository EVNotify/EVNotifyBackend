var express = require('express'),
    app = express(),
    srv_config = require('./srv_config.json'),
    fs = require('fs'),
    cors = require('cors'),
    https = require('https'),
    Rollbar = require("rollbar"),
    session = require('express-session'),
    rollbar = ((!srv_config.ROLLBAR_TOKEN)? false : new Rollbar({
        accessToken: srv_config.ROLLBAR_TOKEN,
        captureUncaught: true,
        environment: ((srv_config.DEBUG)? 'development' : 'production'),
        captureUnhandledRejections: true
    })),
    httpsServer = ((srv_config.DEBUG)? false : https.createServer({
        ca: fs.readFileSync(srv_config.CHAIN_PATH, 'utf8'),
        key: fs.readFileSync(srv_config.PRIVATE_KEY_PATH, 'utf8'),
        cert : fs.readFileSync(srv_config.CERTIFICATE_PATH, 'utf8')}, app)),
    bodyParser = require('body-parser'),
    user = require('./user'),
    mysql = require('mysql'),
    db = require('./db').getPool(),
    telegram = ((!srv_config.TELEGRAM_TOKEN)? false : require('./notification/telegram/')),
    stations = require('./charging/stations/'),
    notification = require('./notification'),
    notificationCron = require('./notification/cron/');

// session handling (for EVNotify Web)
app.use(session({
    secret: srv_config.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: ((srv_config.DEBUG)? false : true)}
}));

// required for parsing JSON
app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
// required for cross origin resource sharing (CORS)
app.use(cors({credentials: true, origin: true}));

// rollbar user tracking and akey fix
app.use(function(req, res, next) {
    // ensure that akey is string
    if(req.body && req.body.akey) req.body.akey = ((typeof req.body.akey.toString === 'function')? req.body.akey.toString() : '');
    req.rollbar_person = {id: ((req.body)? req.body.akey : null)};
    next();
});

// last activity track
app.use(function(req, res, next) {
    if(typeof req.body !== 'undefined' && req.body.akey) {
        var sql = mysql.format('UPDATE accounts SET lastactivity=? WHERE akey=?', [parseInt(new Date().getTime() / 1000), req.body.akey]);

        // update last activity from user in database
        db.query(sql, function(err, queryRes) {
            next(); // just proceed
        });
    } else next();  // just proceed
});

// set required headers
app.use(function(req, res, next) {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', ((req.get('origin') == null || req.get('origin') === 'null')? '*' : req.get('origin') || '*'));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// different routes for the specific functions
app.post('/login', user.login);                 // function to login an account
app.post('/register', user.register);           // function to register an account
app.post('/getkey', user.key);                  // function to retrieve an account key
app.post('/renewtoken', user.token);            // function to renew the account token
app.post('/changepw', user.password);           // function to change the account password
app.post('/settings', user.settings);           // function to get and set the account settings
app.post('/notification', notification.send);   // function to send all notifications to account
app.post('/notificationcron', notificationCron.cronNotification);   // function to start the notification cron job (summary)
app.post('/sync', user.sync);                   // function to sync data to allow fetching or setting the settings for multiple devices
app.post('/syncsoc', user.syncSoC);             // function to sync the soc only (only setting the soc to decrease data usage)
app.post('/socinfo', user.socInfo);             // function to retrieve soc and its information (only getting the soc to decrease data usage)
app.post('/getstations', stations.getStations); // function to get charging stations based on given area and filters
app.post('/getstation', stations.getStation);   // function to get detailed information about specified station
app.post('/getstationphoto', stations.getStationPhoto); // function to retrieve photo for given station photo id
app.post('/getstationcards', stations.getStationCards); // function to retrieve list of available cards

// request function not found
app.use(function(req, res) {
    /**
     * we need to send http state 200 back to client - otherwise cors request calls (or requests such as an option call)
     * will be declined and connection will not be established correctly
     */
    res.status(200).json({message: 'Unknown operation. Unable to handle request', error: 404});
});

// error handler
app.use(function onError(err, req, res, next) {
    // determine critical error (so they will be reported to Rollbar)
    if(err && err.status && err.status !== 500) {
        res.status(err.status || 400).json({message: 'Request could not be processed', error: err.status || 400});
        // track unprocessable request to rollbar to eventually find bugs
        rollbar.warning('Request could not be processed', req);
    } else {
        res.status(500).json({
            message: 'Internal server occured while processing your request. It has been automatically reported and will be fixed as soon as possible.',
            error: 500
        });
        next(err);
    }
});
if(rollbar) app.use(rollbar.errorHandler());

// start telegram bot
if(telegram) telegram.startBot();

if(srv_config.DEBUG && srv_config.PORT) {
    // listen on http port
    app.listen(srv_config.PORT, function () {
        console.log('Server listening on port ' + srv_config.PORT);
    });
} else if(httpsServer && srv_config.HTTPS_PORT) {
    // listen on https port
    httpsServer.listen(srv_config.HTTPS_PORT, function() {
        console.log('Server listening on https port ' + srv_config.HTTPS_PORT);
    });
} else {
    console.error('No server could be started');
    process.exit();
}
