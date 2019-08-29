const util = require('util');
const db = require('../db');
const query = util.promisify(db.query);
const token = require('../token');
const srv_config = require('../../srv_config.json');
const srv_errors = require('../../srv_errors.json');
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');
const PayPalClient = require('../integrations/paypal');

const getRobots = async (req, res) => {
    try {
        // check required params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.query.akey, req.query.token, async (err, valid) => {
            if (!err) {
                if (valid) {
                    const robots = await query('SELECT * FROM robots ORDER BY `order`');
                    const boughtRobots = await query('SELECT * FROM robots_transactions WHERE akey=?', [req.query.akey]);

                    res.json(robots.map((robot) => {
                        const bought = boughtRobots.some((boughtRobot) => boughtRobot.robot === robot.id);

                        return {
                            id: robot.id,
                            quote: bought ? robot.quote : null,
                            bought
                        };
                    }));
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    } catch (err) {
        console.error(err);
        res.send(500);
    }
};

const buyRobot = async (req, res) => {
    try {
        // check required params
        if (!req.body.akey || !req.body.token || !req.body.orderID || !req.body.robotID) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, async (err, valid) => {
            if (!err) {
                if (valid) {
                    const validRobot = (await query('SELECT id FROM robots WHERE id=?', [req.body.robotID]))[0];
                    if (!validRobot) return res.status(404);
                    const hasBought = (await query('SELECT * FROM robots_transactions WHERE akey=? AND robot=?', [req.body.akey, req.body.robotID]))[0];

                    if (hasBought) return res.status(409);
                    const order = await PayPalClient.client().execute(new checkoutNodeJssdk.orders.OrdersGetRequest(req.body.orderID));
                    
                    // Validate the transaction details are as expected
                    if (order.result.purchase_units[0].amount.value !== '2.49') {
                        return res.send(400);
                    }

                    await query('INSERT INTO robots_transactions (akey, robot) VALUES (?, ?)', [req.body.akey, req.body.robotID]);
                    res.send(200);
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    } catch (err) {
        console.error(err);
        res.send(500);
    }
};

module.exports = {
    getRobots,
    buyRobot
};