const assert = require('assert');
const { loadModule, createResponse } = require('../helpers');
const errors = require('../../srv_errors.json');

describe('notification webhook events', () => {
    let loader;
    let events;
    let queries;
    let user;
    let dbError;

    beforeEach(() => {
        events = [];
        queries = [];
        dbError = null;
        user = { akey: 'ABC123', token: 'secret-token', soc_display: 80, soc_bms: 78, last_notification: 0 };
        const unusedChannel = () => { throw new Error('disabled notification channel called'); };
        loader = loadModule('./modules/notification', {
            './modules/db': {
                query: (sql, params, callback) => {
                    queries.push({ sql, params });
                    if (callback) callback(dbError, user ? [user] : []);
                }
            },
            './modules/webhook': { emit: (...args) => events.push(args) },
            './modules/notification/mail': { sendMail: unusedChannel },
            './modules/notification/telegram': { sendMessage: unusedChannel },
            './modules/notification/push': { sendPush: unusedChannel }
        });
    });

    afterEach(() => loader.restore());

    const invoke = body => {
        const res = createResponse();
        loader.module.send({ body: body || { akey: 'ABC123', token: 'secret-token', abort: false } }, res);
        return res;
    };

    [false, true].forEach(abort => {
        it('emits the SOC and abort flag for a successful notification (abort=' + abort + ')', () => {
            const res = invoke({ akey: 'ABC123', token: 'secret-token', abort });
            assert.strictEqual(res.statusCode, 200);
            assert.deepStrictEqual(res.body, { notified: true });
            assert.deepStrictEqual(events, [[
                'ABC123', 'secret-token', 'notification', { soc_display: 80, soc_bms: 78, abort }
            ]]);
            assert.strictEqual(queries.length, 2);
            assert.ok(queries[1].sql.startsWith('UPDATE sync SET last_notification='));
            assert.strictEqual(queries[1].params[1], 'ABC123');
        });
    });

    it('does not emit when credentials are missing', () => {
        const res = invoke({ akey: 'ABC123' });
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(queries.length, 0);
        assert.deepStrictEqual(events, []);
    });

    it('does not emit when the token is invalid', () => {
        user.token = 'different-token';
        assert.strictEqual(invoke().statusCode, 401);
        assert.strictEqual(queries.length, 1);
        assert.deepStrictEqual(events, []);
    });

    it('does not emit when rate limited and returns Retry-After', () => {
        user.last_notification = Math.floor(Date.now() / 1000) + 60;
        const res = invoke();
        assert.strictEqual(res.statusCode, 429);
        assert.deepStrictEqual(res.body.error, errors.TOO_MANY_REQUESTS);
        assert.strictEqual(res.headers['Retry-After'], 60);
        assert.strictEqual(queries.length, 1);
        assert.deepStrictEqual(events, []);
    });

    it('does not emit when the account lookup fails', () => {
        dbError = new Error('database unavailable');
        assert.strictEqual(invoke().statusCode, 422);
        assert.strictEqual(queries.length, 1);
        assert.deepStrictEqual(events, []);
    });

    it('does not emit when the account does not exist', () => {
        user = null;
        assert.strictEqual(invoke().statusCode, 422);
        assert.deepStrictEqual(events, []);
    });
});
