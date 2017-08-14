var express = require('express'),
    app = express(),
    srv_config = require('./srv_config.json'),
    fs = require('fs'),
    cors = require('cors'),
    https = require('https'),
    httpsServer = ((srv_config.DEBUG)? false : https.createServer({
        ca: fs.readFileSync(srv_config.CHAIN_PATH, 'utf8'),
        key: fs.readFileSync(srv_config.PRIVATE_KEY_PATH, 'utf8'),
        cert : fs.readFileSync(srv_config.CERTIFICATE_PATH, 'utf8')}, app)),
    bodyParser = require('body-parser'),
    user = require('./user'),
    telegram = require('./notification/telegram/'),
    notification = require('./notification');

// required for parsing JSON
app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
// required for cross origin resource sharing (CORS)
app.use(cors(null, {credentials: true}));

// different routes for the specific functions
app.post('/login', user.login);                 // function to login an account
app.post('/register', user.register);           // function to register an account
app.post('/getkey', user.key);                  // function to retrieve an account key
app.post('/renewtoken', user.token);            // function to renew the account token
app.post('/changepw', user.password);           // function to change the account password
app.post('/settings', user.settings);           // function to get and set the account settings
app.post('/notification', notification.send);   // function to send all notifications to account
app.post('/sync', user.sync);                   // function to sync data to allow fetching or setting the settings for multiple devices
app.post('/syncsoc', user.syncSoC);             // function to sync the soc only (only setting the soc to decrease data usage)

// request function not found
app.use(function(req, res) {
    res.contentType('application/json');
	res.setHeader('Access-Control-Allow-Origin', '*');
    /**
     * we need to send http state 200 back to client - otherwise cors request calls (or requests such as an option call)
     * will be declined and connection will not be established correctly
     */
    res.status(200).json({message: 'Unknown operation. Unable to handle request', error: 404});
});

// start telegram bot
telegram.startBot();

// listen on port
app.listen(srv_config.PORT, function () {
    console.log('Server listening on port ' + srv_config.PORT);
});

// listen on https port
if(httpsServer) {
    httpsServer.listen(srv_config.HTTPS_PORT, function() {
        console.log('Server listening on https port ' + srv_config.HTTPS_PORT);
    });
}
