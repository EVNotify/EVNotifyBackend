var express = require('express'),
    app = express(),
    srv_config = require('./srv_config.json'),
    fs = require('fs'),
    https = require('https'),
    httpsServer = https.createServer({key: srv_config.PRIVATE_KEY_PATH, cert : srv_config.CERTIFICATE_PATH}, app),
    bodyParser = require('body-parser'),
    user = require('./user'),
    telegram = require('./notification/telegram/'),
    notification = require('./notification');

// required for parsing JSON
app.use(bodyParser.json());         // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

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
    res.status(404).json({message: 'Unknown operation. Unable to handle request', error: 404});
});

// start telegram bot
telegram.startBot();

// listen on port
app.listen(srv_config.PORT, function () {
    console.log('Server listening on port ' + srv_config.PORT);
});

// listen on https port
httpsServer.listen(srv_config.HTTPS_PORT, function() {
    console.log('Server listening on https port ' + srv_config.HTTPS_PORT);
});
