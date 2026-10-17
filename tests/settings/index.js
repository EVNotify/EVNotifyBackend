const assert = require('assert');
const { loadModule, createResponse } = require('../helpers');
const errors = require('../../srv_errors.json');

describe('settings module', () => {
    let loader;
    let queries;
    let dbError;
    let authError;
    let valid;
    let storedWebhook;

    beforeEach(() => {
        queries = [];
        dbError = null;
        authError = null;
        valid = true;
        storedWebhook = 'https://existing.example/hook';
        loader = loadModule('./modules/settings', {
            './modules/db': {
                query: (sql, params, callback) => {
                    queries.push({ sql, params });
                    assert.strictEqual((sql.match(/\?/g) || []).length, params.length);
                    if (sql.startsWith('SELECT')) {
                        assert.deepStrictEqual(params, ['ABC123']);
                        callback(dbError, [{ email: 'enc:mail@example.com', webhook: storedWebhook }]);
                    } else {
                        assert.strictEqual(params[params.length - 1], 'ABC123');
                        if (!dbError && sql.includes('webhook=?')) storedWebhook = params[params.length - 2];
                        callback(dbError, { affectedRows: 1 });
                    }
                }
            },
            './modules/token': {
                validateToken: (akey, token, callback) => {
                    assert.strictEqual(akey, 'ABC123');
                    assert.strictEqual(token, 'secret-token');
                    callback(authError, valid);
                }
            },
            './modules/encryption': {
                encrypt: value => 'enc:' + value,
                decrypt: value => value.slice(4)
            }
        });
    });

    afterEach(() => loader.restore());

    const request = settings => ({
        body: { akey: 'ABC123', token: 'secret-token', settings },
        query: { akey: 'ABC123', token: 'secret-token' }
    });

    it('reads the webhook setting and decrypts email', () => {
        const res = createResponse();
        loader.module.getSettings(request(), res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(queries[0].sql.includes('webhook'));
        assert.deepStrictEqual(res.body.settings, {
            email: 'mail@example.com', webhook: storedWebhook
        });
    });

    it('replaces the webhook URL and still encrypts email', () => {
        const settings = { email: 'mail@example.com', webhook: 'https://new.example/hook' };
        const res = createResponse();
        loader.module.setSettings(request(settings), res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(storedWebhook, settings.webhook);
        assert.strictEqual(queries[0].params[0], 'enc:mail@example.com');
        assert.deepStrictEqual(res.body, { settings });
    });

    it('preserves the existing URL when webhook is omitted, without an extra query', () => {
        const res = createResponse();
        loader.module.setSettings(request({ email: 'mail@example.com' }), res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(storedWebhook, 'https://existing.example/hook');
        assert.strictEqual(queries.length, 1);
        assert.ok(!queries[0].sql.includes('webhook'));
    });

    [null, ''].forEach(value => {
        it('explicitly disables webhooks with ' + JSON.stringify(value), () => {
            const res = createResponse();
            loader.module.setSettings(request({ webhook: value }), res);
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(storedWebhook, value);
            assert.strictEqual(res.body.settings.webhook, value);
        });
    });

    [undefined, null, 'invalid'].forEach(settings => {
        it('rejects invalid settings payload ' + JSON.stringify(settings), () => {
            const res = createResponse();
            loader.module.setSettings(request(settings), res);
            assert.strictEqual(res.statusCode, 400);
            assert.deepStrictEqual(res.body.error, errors.INVALID_PARAMETERS);
            assert.strictEqual(queries.length, 0);
        });
    });

    ['getSettings', 'setSettings'].forEach(handler => {
        it(handler + ' rejects missing credentials without querying the database', () => {
            const res = createResponse();
            const req = request({ webhook: 'https://new.example/hook' });
            delete req.body.token;
            delete req.query.token;
            loader.module[handler](req, res);
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(queries.length, 0);
        });

        it(handler + ' rejects invalid authentication without querying settings', () => {
            valid = false;
            const res = createResponse();
            loader.module[handler](request({ webhook: 'https://new.example/hook' }), res);
            assert.strictEqual(res.statusCode, 401);
            assert.deepStrictEqual(res.body.error, errors.INVALID_TOKEN);
            assert.strictEqual(queries.length, 0);
        });

        it(handler + ' handles authentication lookup failure', () => {
            authError = new Error('authentication lookup failed');
            const res = createResponse();
            loader.module[handler](request({}), res);
            assert.strictEqual(res.statusCode, 422);
            assert.strictEqual(queries.length, 0);
        });

        it(handler + ' reports database failures without changing the stored URL', () => {
            dbError = new Error('database unavailable');
            const res = createResponse();
            loader.module[handler](request({ webhook: 'https://new.example/hook' }), res);
            assert.strictEqual(res.statusCode, 422);
            assert.deepStrictEqual(res.body.error, errors.UNPROCESSABLE_ENTITY);
            assert.strictEqual(storedWebhook, 'https://existing.example/hook');
        });
    });
});
