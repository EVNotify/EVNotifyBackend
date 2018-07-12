/**
 * @file index.js
 * @author GPlay97
 * @description Server initialization script
 */
const express = require('express'),
    app = express(),
    fs = require('fs'),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    srv_config = require('./srv_config.json'),
    srv_errors = require('./srv_errors.json'),
    https = require('https'),
    httpsServer = ((!srv_config.DEBUG && srv_config.CHAIN_PATH &&
        srv_config.PRIVATE_KEY_PATH && srv_config.CERTIFICATE_PATH) ? https.createServer({
        ca: fs.readFileSync(srv_config.CHAIN_PATH, 'utf-8'),
        key: fs.readFileSync(srv_config.PRIVATE_KEY_PATH, 'utf-8'),
        cert: fs.readFileSync(srv_config.CERTIFICATE_PATH, 'utf-8')
    }) : false),
    Rollbar = require('rollbar'),
    rollbar = ((srv_config.ROLLBAR_TOKEN) ? new Rollbar({
        accessToken: srv_config.ROLLBAR_TOKEN,
        captureUncaught: true,
        environment: ((srv_config.DEBUG) ? 'development' : 'production'),
        captureUnhandledRejections: true
    }) : false),
    moesifExpress = require('moesif-express'),
    moesif = ((srv_config.MOESIF_TOKEN) ? moesifExpress({
        applicationId: srv_config.MOESIF_TOKEN,
        identifyUser: (req, res) => req.body.akey
    }) : false),
    db = require('./modules/db'),
    account = require('./modules/account');

// ensure that session secret is valid
if (!srv_config.SESSION_SECRET || typeof srv_config.SESSION_SECRET !== 'string') throw new Error('No session secret given within config');
// session handling
app.use(session({
    secret: srv_config.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: (httpsServer !== false)
    }
}));

// body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Cross-Origin-Resource-Sharing support
app.use(cors({
    credentials: true,
    /**
     * Handles the origin for CORS request
     * @param {String} origin the origin
     * @param {Function} callback callback function
     */
    origin: (origin, callback) => {
        if (!origin || origin === 'null') origin = '*';
        callback(null, origin);
    }
}));

// add additional keys before processing the request
app.use((req, res, next) => {
    // attach akey to be tracked by rollbar
    req.rollbar_person = {
        id: ((req.body.akey && typeof req.body.akey.toString === 'function') ? req.body.akey.toString() : null)
    };
    // attach api_version to be tracked by moesif
    req.api_version = '2';
    next();
});

// moesif middleware
if (moesif) app.use(moesif);

// last activity track
app.use((req, res, next) => {
    if (req.body.akey) db.query('UPDATE accounts SET lastactivity=? WHERE akey=?', [parseInt(new Date() / 1000), req.body.akey], () => next());
    else next();
});

// set default headers
app.use((req, res, next) => {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', ((!req.get('origin') || req.get('origin') === 'null') ? '*' : req.get('origin')));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

app.get('/key', account.getKey);
app.post('/register', account.register);

// requested route does not exist
app.use((req, res) => res.status(404).json({
    error: srv_errors.UNKNOWN_ROUTE
}));

// error handler
app.use(function onError(err, req, res, next) {
    /**
     * Rollbar automatically handles critical errors
     * If status 500, just send info and prevent further processing
     * Otherwise proceed - but send warning to rollbar log
     */
    if (err && err.status && err.status !== 500) {
        // just a warning
        res.status(err.status || 400).json({
            error: srv_errors.BAD_REQUEST,
            debug: ((srv_config.DEBUG) ? err : null)
        });
        rollbar.warning('Bad request', req);
    } else {
        // critical - prevent further processing
        res.status(500).json({
            error: srv_errors.INTERNAL_SERVER_ERROR,
            debug: ((srv_config.DEBUG && err) ? err.message || err : null)
        });
        next(err);
    }
});

// rollbar middleware
if (rollbar) app.use(rollbar.errorHandler());

// TODO telegram..

// ensure that port is valid
if (typeof srv_config.PORT !== 'number' || srv_config.PORT < 1024 || srv_config.PORT > 49151) throw new Error('Port must be between 1024 and 49151');

// initialize the server
if (srv_config.DEBUG) app.listen(srv_config.PORT, () => console.log('[HTTP] Server started on port ', srv_config.PORT));
else if (httpsServer) httpsServer.listen(srv_config.PORT, () => console.log('[HTTPS] Server started on port ', srv_config.PORT));
else throw new Error('Server could not be started');