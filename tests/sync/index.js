const assert = require('assert');
const { loadModule, createResponse } = require('../helpers');
const errors = require('../../srv_errors.json');

const cases = [
    { handler: 'postSoC', type: 'soc', data: { display: 80, bms: 78 }, payload: { display: 80, bms: 78 } },
    { handler: 'postExtended', type: 'extended', data: { soh: 98, charging: 1 } },
    {
        handler: 'postLocation', type: 'location',
        data: { location: { latitude: 50, longitude: 8, speed: 20, accuracy: 5, timestamp: 123 } },
        payload: { latitude: 50, longitude: 8, speed: 20, accuracy: 5, timestamp: 123 }
    }
];

describe('sync webhook events', () => {
    let loader;
    let events;
    let queries;
    let valid;
    let authError;
    let failedStage;
    let recent;

    beforeEach(() => {
        events = [];
        queries = [];
        valid = true;
        authError = null;
        failedStage = null;
        recent = false;
        loader = loadModule('./modules/sync', {
            './modules/db': {
                query: (sql, params, callback) => {
                    queries.push(sql);
                    const stage = sql.split(' ')[0];
                    if (stage === failedStage) return callback(new Error('database failure'));
                    if (stage === 'SELECT') {
                        const timestamp = recent ? Math.floor(Date.now() / 1000) + 60 : 0;
                        return callback(null, [{ last_soc: timestamp, last_extended: timestamp, last_location: timestamp }]);
                    }
                    callback(null, { affectedRows: 1 });
                }
            },
            './modules/token': { validateToken: (akey, token, callback) => {
                assert.strictEqual(akey, 'ABC123');
                assert.strictEqual(token, 'secret-token');
                callback(authError, valid);
            } },
            './modules/webhook': { emit: (...args) => events.push(args) },
            './modules/integrations/abrp': { submitData: () => {} }
        });
    });

    afterEach(() => loader.restore());

    cases.forEach(testCase => {
        const request = () => ({ body: Object.assign({ akey: 'ABC123', token: 'secret-token' }, testCase.data) });
        const invoke = req => {
            const res = createResponse();
            loader.module[testCase.handler](req || request(), res);
            return res;
        };

        it(testCase.handler + ' emits exactly one event after successful writes', () => {
            const req = request();
            const res = invoke(req);
            assert.strictEqual(res.statusCode, 200);
            assert.ok(res.body.synced);
            assert.strictEqual(queries.length, 3);
            assert.deepStrictEqual(events, [[
                'ABC123', 'secret-token', testCase.type, testCase.payload || req.body
            ]]);
        });

        it(testCase.handler + ' still emits when recent updates skip the statistics insert', () => {
            recent = true;
            const res = invoke();
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(queries.length, 2);
            assert.strictEqual(events.length, 1);
        });

        it(testCase.handler + ' rejects missing credentials without emitting', () => {
            const req = request();
            delete req.body.token;
            const res = invoke(req);
            assert.strictEqual(res.statusCode, 400);
            assert.deepStrictEqual(res.body.error, errors.INVALID_PARAMETERS);
            assert.strictEqual(queries.length, 0);
            assert.deepStrictEqual(events, []);
        });

        it(testCase.handler + ' rejects invalid authentication without emitting', () => {
            valid = false;
            const res = invoke();
            assert.strictEqual(res.statusCode, 401);
            assert.strictEqual(queries.length, 0);
            assert.deepStrictEqual(events, []);
        });

        it(testCase.handler + ' handles authentication lookup errors without emitting', () => {
            authError = new Error('authentication lookup failed');
            assert.strictEqual(invoke().statusCode, 422);
            assert.strictEqual(queries.length, 0);
            assert.deepStrictEqual(events, []);
        });

        ['SELECT', 'UPDATE', 'INSERT'].forEach(stage => {
            it(testCase.handler + ' does not emit when the ' + stage + ' fails', () => {
                failedStage = stage;
                const res = invoke();
                assert.strictEqual(res.statusCode, 422);
                assert.deepStrictEqual(res.body.error, errors.UNPROCESSABLE_ENTITY);
                assert.deepStrictEqual(events, []);
            });
        });
    });

    it('rejects SOC without either reading and location with an invalid payload', () => {
        const res = createResponse();
        loader.module.postSoC({ body: { akey: 'ABC123', token: 'secret-token' } }, res);
        assert.strictEqual(res.statusCode, 400);
        const locationRes = createResponse();
        loader.module.postLocation({ body: { akey: 'ABC123', token: 'secret-token', location: 'invalid' } }, locationRes);
        assert.strictEqual(locationRes.statusCode, 400);
        assert.deepStrictEqual(events, []);
        assert.strictEqual(queries.length, 0);
    });

    [undefined, null].forEach(location => {
        it('rejects ' + location + ' location before accessing its properties', () => {
            const res = createResponse();
            loader.module.postLocation({ body: { akey: 'ABC123', token: 'secret-token', location } }, res);
            assert.strictEqual(res.statusCode, 400);
            assert.deepStrictEqual(res.body.error, errors.INVALID_PARAMETERS);
            assert.strictEqual(queries.length, 0);
            assert.deepStrictEqual(events, []);
        });
    });
});
