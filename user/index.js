var passwordHash = require('password-hash'),
    crypto = require('crypto'),
    encryption = require('./../encryption/'),
    srv_config = require('./../srv_config.json'),
    mysql = require('mysql'),
    db = mysql.createConnection({
        host     : srv_config.DB_HOST,
        user     : srv_config.DB_USER,
        password : srv_config.DB_PW,
        database : srv_config.DB_DB
    });

/**
 * Function which generates a random account key which isn't in use
 * @param  {Function} callback callback function
 * @return {String|Error}     the generated akey or error object
 */
function generateKey(callback) {
    var randomKey = crypto.randomBytes(3).toString('hex'),
        sql = mysql.format('SELECT akey FROM accounts WHERE akey=?', [randomKey]);

    // check if akey already exists
    db.query(sql, function(err, queryRes) {
        if(!err && queryRes) {
            if(queryRes.length) generateKey(callback);  // already exists, generate new akey
            else callback(null, randomKey); // successfull, return akey
        } else callback(err, null);
    });
}

/**
 * key request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.key = function(req, res) {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // generate key
    generateKey(function(err, key) {
        if(!err && key) res.json({message: 'AKey created', akey: key});
        else res.status(409).json({message: 'AKey creation failed', error: err});
    });
};

/**
 * Function which creates an account for specified akey and generates token
 * @param  {Integer}   akey    the account key from user
 * @param  {String}   password the specified password for the new account
 * @param  {Function} callback callback function
 * @return {Object|Error}      object which contains the generated random token or error information
 */
function register(akey, password, callback) {
    // generate password hash and create random token
    var generatedPW = passwordHash.generate(password, {algorithm: 'sha512'}),
        randomToken = crypto.randomBytes(10).toString('hex');

    if(generatedPW && randomToken) {
        var sql = mysql.format('SELECT akey FROM accounts WHERE akey=?', [akey]);

        // check if account already exists
        db.query(sql, function(err, queryRes) {
            if(!err && queryRes) {
                if(queryRes.length) callback('account already registered', null);   // account already exists
                else {
                    var sql = mysql.format('INSERT INTO accounts (akey, pw_hash, token) VALUES (?, ?, ?)', [akey, generatedPW, randomToken]);

                    // save account and return required information
                    db.query(sql, function(err, queryRes) {
                        callback(err, ((err)? null : {token: randomToken}));
                    });
                }
            } else callback(err, null);
        });
    } else callback('hashing or token generation failed', null);
}

/**
 * registration request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.register = function(req, res) {
    res.contentType('application/json');
	res.setHeader('Access-Control-Allow-Origin', '*');

    // check required params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password) {
        // register account
        register(req.body.akey, req.body.password, function(err, regRes) {
            if(!err && regRes) res.json({message: 'Registration successfull', token: regRes.token});
            else res.status(409).json({message: 'Registration failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which logins the user and returns the token
 * @param  {Integer}   akey     the account key from user
 * @param  {String}   password  the specified password to use for login
 * @param  {Function} callback  callback function
 * @return {Object|Error}       object which contains the token or error information
 */
function login(akey, password, callback) {
    var sql = mysql.format('SELECT token, pw_hash FROM accounts WHERE akey=?', [akey]);

    // check if specified account exists
    db.query(sql, function(err, queryRes) {
        if(!err && queryRes) {
            if(queryRes.length) {
                // hash password and compare if matches with the saved one in database
                if(passwordHash.verify(password, queryRes[0].pw_hash)) callback(null, {token: queryRes[0].token});  // login successfull
                else callback('invalid credentials', null); // login failed because password doesn't match
            } else callback('account does not exist', null);   // account doesn't exist
        } else callback(err, null);
    });
}

/**
 * login request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.login = function(req, res){
    res.contentType('application/json');
	res.setHeader('Access-Control-Allow-Origin', '*');

    // check required params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password) {
        // login account
        login(req.body.akey, req.body.password, function(err, loginRes) {
            if(!err && loginRes) res.json({message: 'Login successfull', token: loginRes.token});
            else res.status(409).json({message: 'Login failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which allows setting a new password
 * @param  {String}   akey        the akey from account
 * @param  {String}   oldPassword the old password
 * @param  {String}   newpassword the new password to set
 * @param  {Function} callback    callback function
 * @return {Boolean|Error}               returns the state of success and in case of error an error object
 */
function changePW(akey, oldPassword, newpassword, callback) {
    // check credentials
    login(akey, oldPassword, function(err, loginRes) {
        if(!err) {
            var hashedPassword = passwordHash.generate(newpassword, {algorithm: 'sha512'}),
                sql = mysql.format('UPDATE accounts SET pw_hash=? WHERE akey=?', [hashedPassword, akey]);

            if(hashedPassword) {
                db.query(sql, function(err, queryRes) {
                    callback(err, ((err)? false : true));
                });
            } else callback(500, false);
            // hash password and update
        } else callback(err, false);
    });
}

/**
 * password request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.password = function(req, res) {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password && req.body.newpassword) {
        changePW(req.body.akey, req.body.password, req.body.newpassword, function(err, success) {
            if(!err) res.json({message: 'Password change succeeded'});
            else res.status(409).json({message: 'Password change failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which fetches the settings from given account key and returns them
 * NOTE: requires prrevious authentication
 * @param  {String} akey        the account key
 * @return {Error|Object}       Error or the settings object
 */
function getSettings(akey) {
    // TODO
}

/**
 * Function which sets the settings for a given account key
 * @param {String} akey                 the account key
 * @param {Error|Boolean} settingsObj   Error object and boolean which indicates the success state
 */
function setSettings(akey, settingsObj) {
    // TODO
}

/**
 * settings request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.settings = function(req, res) {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password && req.body.token && typeof req.body.option === 'string') {
        // check if credentials are valid
        login(req.body.akey, req.body.password, function(err, loginRes) {
            if(!err && loginRes) {
                // validate token
                if(loginRes.token === req.body.token) {
                    // check option
                    if(req.body.option.toUpperCase() === 'GET') {
                        // get settings and send the setting result to user
                        getSettings(req.body.akey, function(err, getRes) {
                            if(!err && getRes) res.json({message: 'Get settings succeeded', settings: getRes});
                            else res.status(409).json({message: 'Get settings failed', error: err});
                        });
                    } else if(req.body.option.toUpperCase() === 'SET' && typeof req.body.optionObj === 'object') {
                        // set settings and inform the user about the success state
                        setSettings(req.body.akey, req.body.optionObj, function(err, setRes) {
                            if(!err) res.json({message: 'Set settings succeeded'});
                            else res.status(409).json({message: 'Set settings failed', error: err});
                        });
                    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
                } else res.status(401).json({message: 'Unauthorized', error: 401});
            } else res.status(409).json({message: 'Login failed: ', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which allows to generate a new token and sets the new token for the account
 * @param  {String}   akey     the akey from the account
 * @param  {String}   password the specified password
 * @param  {Function} callback callback function
 * @return {String|Error}      returns either the new token or an error object
 */
function renewToken(akey, password, callback) {
    // check if credentials are valid
    login(akey, password, function(err, loginRes) {
        if(!err) {
            var newToken = crypto.randomBytes(10).toString('hex'),
                sql = mysql.format('UPDATE accounts SET token=? WHERE akey=?', [newToken, akey]);

            // update the token
            db.query(sql, function(err, queryRes) {
                callback(err, ((err)? null : newToken));
            });
        } else callback(err, null);
    });
}

/**
 * token request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.token = function(req, res) {
    res.contentType('application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password) {
        renewToken(req.body.akey, req.body.password, function(err, newToken) {
            if(!err && newToken) res.json({message: 'Token renewed', token: newToken});
            else res.status(409).json({message: 'Token renewal failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};
