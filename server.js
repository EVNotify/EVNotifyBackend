var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    srv_config = require('./srv_config.json'),
    user = require('./user');

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

// request function not found
app.use(function(req, res) {
    res.contentType('application/json');
	res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(404).json({message: 'Unknown operation. Unable to handle request', error: 404});
});


// listen on port
app.listen(srv_config.PORT, function () {
    console.log('Server listening on port ' + srv_config.PORT);
});
