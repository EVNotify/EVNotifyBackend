const util = require('util');
const db = require('../db');
const query = util.promisify(db.query);
const token = require('../token');
const srv_config = require('../../srv_config.json');
const srv_errors = require('../../srv_errors.json');
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');
const PayPalClient = require('../integrations/paypal');

const getCats = async (req, res) => {
    try {
        // check required params
        if (!req.query.akey || !req.query.token || !req.query.tag) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.query.akey, req.query.token, async (err, valid) => {
            if (!err) {
                if (valid) {
                    const cats = await query('SELECT * FROM cats WHERE tag=? ORDER BY RAND()', [req.query.tag]);
                    const boughtCats = await query('SELECT * FROM cats_transactions WHERE akey=?', [req.query.akey]);

                    res.json(cats.map((cat) => {
                        const bought = boughtCats.some((boughtCat) => boughtCat.cat === cat.id);

                        return {
                            id: cat.id,
                            tag: cat.tag,
                            quote: bought ? cat.quote : null,
                            order: cat.order,
                            release_date: cat.release_date,
                            release_price: cat.release_price,
                            follow_up_price: cat.follow_up_price,
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

const buyCat = async (req, res) => {
    try {
        // check required params
        if (!req.body.akey || !req.body.token || !req.body.orderID || !req.body.catID) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, async (err, valid) => {
            if (!err) {
                if (valid) {
                    const validCat = (await query('SELECT id, release_date, release_price, follow_up_price, required_cat FROM cats WHERE id=?', [req.body.catID]))[0];
                    if (!validCat) return res.status(404);
                    const currentDate = new Date(new Date().toISOString().substring(0, 10)) / 1000;

                    if (currentDate < validCat.release_date) return res.status(403);

                    const hasBought = (await query('SELECT * FROM cats_transactions WHERE akey=? AND cat=?', [req.body.akey, req.body.catID]))[0];

                    if (hasBought) return res.status(409);

                    if (validCat.required_cat) {
                        const boughtRequiredCat = (await query('SELECT * FROM cats_transactions WHERE akey=? AND cat=?', [req.body.akey, validCat.required_cat]))[0];

                        if (!boughtRequiredCat) return res.status(403);
                    }

                    const order = await PayPalClient.client().execute(new checkoutNodeJssdk.orders.OrdersGetRequest(req.body.orderID));
                    
                    // Validate the transaction details are as expected
                    const priceToUse = validCat.release_date === currentDate ? validCat.release_price : validCat.follow_up_price;

                    if (order.result.purchase_units[0].amount.value != priceToUse) {
                        return res.send(400);
                    }

                    await query('INSERT INTO cats_transactions (akey, cat) VALUES (?, ?)', [req.body.akey, req.body.catID]);
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
    getCats,
    buyCat
};