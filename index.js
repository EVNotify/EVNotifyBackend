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
    }, app) : false),
    rookout = require('rookout'),
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
        identifyUser: req => req.body.akey,
        getApiVersion: () => '2',
        skip: req => {
            const path = req.path.toLowerCase();
            
            return path === '/location' || path === '/debug' || path === '/soc' || path === '/extended'
        }
    }) : false),
    db = require('./modules/db'),
    account = require('./modules/account'),
    sync = require('./modules/sync'),
    token = require('./modules/token'),
    report = require('./modules/report'),
    settings = require('./modules/settings'),
    notifications = require('./modules/notification'),
    telegram = require('./modules/notification/telegram'),
    push = require('./modules/notification/push'),
    stations = require('./modules/stations'),
    logs = require('./modules/logs'),
    qr = require('./modules/qr'),
    robots = require('./modules/robots'),
    cats = require('./modules/cats'),
    abrpIntegration = require('./modules/integrations/abrp'),
    webAccount = require('./modules/web/account');

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
    // fix akey to force string
    req.body.akey = ((req.body.akey && typeof req.body.akey.toString === 'function') ? req.body.akey.toString() : '');
    // attach akey to be tracked by rollbar
    req.rollbar_person = {
        id: req.body.akey || null
    };
    next();
});

// moesif middleware
if (moesif) app.use(moesif);

if (srv_config.ROOKOUT_TOKEN) rookout.start({token: srv_config.ROOKOUT_TOKEN});

// last activity track
app.use((req, res, next) => {
    if (req.body.akey) db.query('UPDATE accounts SET lastactivity=? WHERE akey=?', [Math.floor(Date.now() / 1000), req.body.akey], () => next());
    else next();
});

// set default headers
app.use((req, res, next) => {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', ((!req.get('origin') || req.get('origin') === 'null') ? '*' : req.get('origin')));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// the routes
app.get('/key', account.getKey);
app.post('/register', account.register);
app.post('/login', account.login);
app.post('/changepw', account.changePW);
app.get('/settings', settings.getSettings);
app.put('/settings', settings.setSettings);
app.post('/soc', sync.postSoC);
app.get('/soc', sync.getSoC);
app.post('/extended', sync.postExtended);
app.get('/extended', sync.getExtended);
app.post('/location', sync.postLocation);
app.get('/location', sync.getLocation);
app.put('/renewtoken', token.renewToken);
app.get('/report', report.downloadReport);
app.post('/notification', notifications.send);
app.get('/stations', stations.getStations);
app.get('/station', stations.getStation);
app.get('/stationphoto', stations.getStationPhoto);
app.get('/stationcards', stations.getStationCards);
app.get('/logs', logs.getLogs);
app.get('/logdetail/latest', logs.getLatestLog);
app.get('/logdetail', logs.getLog);
app.post('/logdetail', logs.createLog);
app.put('/logdetail', logs.updateLog);
app.delete('/logdetail', logs.deleteLog);
app.get('/logexport', logs.exportLog);
app.put('/qr', qr.createQR);
app.post('/sendqr', qr.sendQR);
app.delete('/qr', qr.deleteQR);
app.get('/qr', qr.qrStatus);
app.post('/qrnotify', qr.qrNotify);
app.get('/robots', robots.getRobots);
app.post('/robot', robots.buyRobot);
app.get('/cats', cats.getCats);
app.post('/cat', cats.buyCat);
app.post('/debug', (req, res) => {
    if (typeof req.body.data === 'string') {
        db.query('INSERT INTO debug (data, akey, timestamp) VALUES (?, ?, ?)', [
            req.body.data, req.body.akey, ((parseInt(req.body.timestamp)) ? req.body.timestamp : Math.floor(Date.now() / 1000))
        ], (err, dbRes) => {
            if (!err && dbRes) {
                res.json({status: true});
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
});
// the web routes
app.post('/web/register', webAccount.register);
app.post('/web/login', webAccount.login);
// integrations routes
app.get('/integrations/abrp/auth/:akey/:token', abrpIntegration.auth);

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
        if (rollbar) rollbar.warning('Bad request', req);
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

// start telegram bot
telegram.startBot();

// initialize push
push.init();

// ensure that port is valid
if (typeof srv_config.PORT !== 'number' || srv_config.PORT < 1024 || srv_config.PORT > 49151) throw new Error('Port must be between 1024 and 49151');

// initialize the server
if (srv_config.DEBUG) app.listen(srv_config.PORT, () => console.log('[HTTP] Server started on port ', srv_config.PORT));
else if (httpsServer) httpsServer.listen(srv_config.PORT, () => console.log('[HTTPS] Server started on port ', srv_config.PORT));
else throw new Error('Server could not be started');
