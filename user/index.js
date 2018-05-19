var passwordHash = require('password-hash'),
    crypto = require('crypto'),
    encryption = require('./../encryption/'),
    srv_config = require('./../srv_config.json'),
    helper = require('./../helper'),
    mysql = require('mysql'),
    db = require('./../db/').getPool();

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
    // generate key
    generateKey(function(err, key) {
        if(!err && key) res.json({message: 'AKey created', akey: key});
        else res.status(409).json({message: 'AKey creation failed', error: err});
    });
};
/**
 * checks if a password is invalid
 * @param {String} password the password to check
 * @return {String | false} false if the password is valid, else a string containing the error message
 */
function isInvalidPassword(password) {
    if (typeof password !== 'string' || password.length < 6) {
        return "The password must be a string with at least 6 characters.";
    }
    return false;
}

/**
 * Function which creates an account for specified akey and generates token
 * @param  {Integer}   akey    the account key from user
 * @param  {String}   password the specified password for the new account
 * @param  {Function} callback callback function
 * @return {Object|Error}      object which contains the generated random token or error information
 */
function register(akey, password, callback) {
    var invalidPassword = isInvalidPassword(password),
        generatedPW,
        randomToken;

    if (invalidPassword) return callback(invalidPassword);

    // generate password hash and create random token
    try {
        generatedPW = passwordHash.generate(password, {algorithm: 'sha512'});
        randomToken = crypto.randomBytes(10).toString('hex');
    } catch (e) {}

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
                        if(!err) {
                            // link required settings table
                            sql = mysql.format('INSERT INTO settings (user, akey) VALUES (?, ?)', [akey, akey]);

                            db.query(sql, function(err, queryRes) {
                                if(!err) {
                                    // link required stats table
                                    sql = mysql.format('INSERT INTO stats (user, akey) VALUES (?, ?)', [akey, akey]);

                                    db.query(sql, function(err, queryRes) {
                                        callback(err, ((err)? null : {token: randomToken}));
                                    });
                                } else callback(err, null);
                            });
                        } else callback(err, null);
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
 * @param  {String}   token       the token from account
 * @param  {String}   oldPassword the old password
 * @param  {String}   newpassword the new password to set
 * @param  {Function} callback    callback function
 * @return {Boolean|Error}               returns the state of success and in case of error an error object
 */
function changePW(akey, token, oldPassword, newpassword, callback) {
    var invalidPassword = isInvalidPassword(newpassword),
        hashedPassword;

    if (invalidPassword) {
        return callback(invalidPassword);
    }

    // check credentials
    login(akey, oldPassword, function(err, loginRes) {
        if(!err && loginRes) {
            // validate token
            if(loginRes.token === token) {
                // hash password and update
                try {
                    hashedPassword = passwordHash.generate(newpassword, {algorithm: 'sha512'});
                } catch (e) {}

                var sql = mysql.format('UPDATE accounts SET pw_hash=? WHERE akey=?', [hashedPassword, akey]);

                if(hashedPassword) {
                    db.query(sql, function(err, queryRes) {
                        callback(err, ((err)? false : true));
                    });
                } else callback(400, false);
            } else callback(401, false);
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
    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.token && req.body.password && req.body.newpassword) {
        changePW(req.body.akey, req.body.token, req.body.password, req.body.newpassword, function(err, success) {
            if(!err) res.json({message: 'Password change succeeded'});
            else res.status(409).json({message: 'Password change failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which fetches the settings from given account key and returns them
 * NOTE: requires previous authentication
 * @param  {String} akey        the account key
 * @param  {Function} callback  the callback function
 * @return {Error|Object}       Error or the settings object
 */
function getSettings(akey, callback) {
    var sql = mysql.format('SELECT accounts.akey, email, telegram, soc, curSoC, lastSoC, consumption, device, polling, autoSync, lng, push, summary FROM settings \
        INNER JOIN accounts ON accounts.akey=settings.akey INNER JOIN stats ON accounts.akey=stats.akey WHERE accounts.akey=?', [akey]);

    db.query(sql, function(err, queryRes) {
        if(!err && queryRes && queryRes[0]) queryRes[0].email = encryption.decrypt(((queryRes[0].email)? queryRes[0].email : ''));  // decrypt mail
        callback(err, ((err)? null : ((queryRes && queryRes[0])? queryRes[0] : {})));
    });
}

/**
 * Function which sets the settings for a given account key
 * NOTE: requires previous authentication
 * @param {String} akey             the account key
 * @param {Object} settingsObj      the new settings to be applied
 * @param {Function} callback       the callback function
 * @return {Error|Boolean}          Error object or boolean which indicates the success state
 */
function setSettings(akey, settingsObj, callback) {
    var sql = mysql.format('UPDATE settings INNER JOIN accounts ON accounts.akey=settings.akey INNER JOIN stats ON accounts.akey=stats.akey \
        SET email=?, telegram=?, soc=?, curSoC=?, lastSoC=?, consumption=?, device=?, polling=?, autoSync=?, lng=?, push=?, summary=? WHERE accounts.akey=?', [
        ((settingsObj.email)? encryption.encrypt(settingsObj.email) : ''),  // encrypt email
        settingsObj.telegram,
        settingsObj.soc,
        settingsObj.curSoC,
        settingsObj.lastSoC,
        settingsObj.consumption,
        settingsObj.device,
        settingsObj.polling,
        settingsObj.autoSync,
        settingsObj.lng,
        settingsObj.push,
        settingsObj.summary,
        akey
    ]);

    db.query(sql, function(err, queryRes) {
        callback(err, ((err)? false : true));
    });
}

/**
 * settings request handler
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.settings = function(req, res) {
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
                            if(!err && setRes) res.json({message: 'Set settings succeeded'});
                            else res.status(409).json({message: 'Set settings failed', error: err});
                        });
                    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
                } else res.status(401).json({message: 'Unauthorized', error: 401});
            } else res.status(409).json({message: 'Login failed', error: err});
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
    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.password) {
        renewToken(req.body.akey, req.body.password, function(err, newToken) {
            if(!err && newToken) res.json({message: 'Token renewed', token: newToken});
            else res.status(409).json({message: 'Token renewal failed', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * Function which validates given token and checks if token from akey matches with submitted token
 * @param  {String}   akey     the account key
 * @param  {String}   token    the token to validate
 * @param  {Function} callback callback function
 * @return {Error|Boolean}     whether or not the validation of token was successfull or if there was an error
 */
function validateToken(akey, token, callback) {
    var sql = mysql.format('SELECT token FROM accounts WHERE akey=?', [akey]);

    // validate token
    db.query(sql, function(err, queryRes) {
        callback(err, ((err)? false : ((queryRes && queryRes[0] && queryRes[0].token === token)? true : false)));   // whether or not the token is equal
    });
}

/**
 * Function which checks if given account has the autoSync property turned on
 * @param  {String}   akey     the account key to check for autoSync property
 * @param  {String}   token    the token linked to account
 * @param  {Function} callback callback function
 * @return {Error|Boolean}     error or boolean if autoSync is on for user or not
 */
function hasSyncOn(akey, token, callback) {
    // first validate token
    validateToken(akey, token, function(err, valid) {
        if(!err && valid) {
            var sql = mysql.format('SELECT autoSync FROM settings INNER JOIN accounts ON accounts.akey=settings.akey WHERE token=?', [token]);

            db.query(sql, function(err, queryRes) {
                callback(err, ((err)? false : ((queryRes && queryRes[0] && queryRes[0].autoSync)? true : false)));
            });
        } else callback(err, null);
    });
}

/**
 * sync request handler for pull and push complete settings
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.sync = function(req, res) {
    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.token && typeof req.body.type === 'string') {
        // validate type
        if((req.body.type.toUpperCase() === 'PUSH' && req.body.syncObj) || req.body.type.toUpperCase() === 'PULL') {
            // validate token and sync property
            hasSyncOn(req.body.akey, req.body.token, function(err, syncOn) {
                if(!err && syncOn) {
                    if(req.body.type.toUpperCase() === 'PUSH') {
                        setSettings(req.body.akey, req.body.syncObj, function(err, pushRes) {
                            if(!err && pushRes) res.json({message: 'Push for sync succeeded', syncRes: pushRes});
                            else res.status(409).json({message: 'Push for sync failed', error: err});
                        });
                    } else {
                        getSettings(req.body.akey, function(err, pullRes) {
                            if(!err && pullRes) res.json({message: 'Pull for sync succeeded', syncRes: pullRes});
                            else res.status(409).json({message: 'Pull for sync failed', error: err});
                        });
                    }
                } else res.status(409).json({message: 'Sync not enabled', error: err});
            });
        } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * sync request handler for soc only
 * NOTE: it only supports settings the soc!
 *          will be used on autoSyncing the soc to decrease data usage
 * @param  {ServerRequest} req server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.syncSoC = function(req, res) {
    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.token && typeof req.body.soc === 'number') {
        // validate token and sync property
        hasSyncOn(req.body.akey, req.body.token, function(err, syncOn) {
            if(!err && syncOn) {
                var sql = mysql.format('UPDATE stats INNER JOIN accounts ON accounts.akey=stats.akey SET curSoC=?, lastSoC=? WHERE token=?',
                    [req.body.soc, parseInt(new Date().getTime() / 1000), req.body.token]);

                db.query(sql, function(err, queryRes) {
                    if(!err && queryRes) {
                        // register within statistics
                        var sql = mysql.format('INSERT INTO statistics (`akey`, `type`, `value`, `timestamp`) VALUES (?,?,?,?)',
                            [req.body.akey, 'soc', req.body.soc, parseInt(new Date().getTime() / 1000)]);

                        db.query(sql, function(err, queryRes) {
                            if(!err && queryRes) res.json({message: 'Sync for soc succeeded'});
                            else res.status(409).json({message: 'Sync for soc failed', error: err});
                        });
                    } else res.status(409).json({message: 'Sync for soc failed', error: err});
                });
            } else res.status(409).json({message: 'Sync not enabled: ', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};

/**
 * soc info request handler
 * NOTE: Retrieves the last submitted state of charge as well as the timestamp for it.
 *      It will also calculate the estimated range
 * @param  {ServerRequest} req  server request
 * @param  {ServerResponse} res server response
 * @return {ServerResponse}
 */
exports.socInfo = function(req, res) {
    // check params
    if(typeof req.body !== 'undefined' && req.body.akey && req.body.token) {
        // validate token and sync property
        hasSyncOn(req.body.akey, req.body.token, function(err, syncOn) {
            if(!err && syncOn) {
                var sql = mysql.format('SELECT curSoC, lastSoC, consumption FROM stats INNER JOIN settings ON stats.akey=settings.akey \
                    INNER JOIN accounts ON stats.akey=accounts.akey WHERE token=?', [req.body.token]);

                db.query(sql, function(err, queryRes) {
                    if(!err && queryRes && queryRes[0]) {
                        // send soc information
                        res.json({message: 'Soc info succeeded', socInfo: {
                            soc: queryRes[0].curSoC,
                            timestamp: queryRes[0].lastSoC,
                            range: helper.calculateEstimatedRange(queryRes[0].curSoC, queryRes[0].consumption)
                        }});
                    } else res.status(409).json({message: 'Soc info failed', error: err});
                });
            } else res.status(409).json({message: 'Sync not enabled: ', error: err});
        });
    } else res.status(422).json({message: 'Missing parameters. Unable to handle request', error: 422});
};
