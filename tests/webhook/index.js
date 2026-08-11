/**
 * @file tests/webhook/index.js
 * @author GPlay97
 * @description Tests for webhook module
 */
const assert = require('assert');
const path = require('path');

const loadWebhookModule = stubs => {
    const modulePath = path.resolve(__dirname, './../../modules/webhook');
    const resolvedModulePath = require.resolve(modulePath);
    const dbPath = require.resolve(path.resolve(__dirname, './../../modules/db'));
    const requestPath = require.resolve('request');
    const replacements = [
        [dbPath, stubs.db],
        [requestPath, stubs.request]
    ];
    const originals = new Map();

    delete require.cache[resolvedModulePath];

    replacements.forEach(([target, value]) => {
        originals.set(target, require.cache[target]);
        require.cache[target] = {
            id: target,
            filename: target,
            loaded: true,
            exports: value
        };
    });

    const webhook = require(modulePath);

    return {
        webhook,
        restore: () => {
            delete require.cache[resolvedModulePath];

            replacements.forEach(([target]) => {
                const original = originals.get(target);

                if (original) require.cache[target] = original;
                else delete require.cache[target];
            });
        }
    };
};

describe('webhook module', () => {
    it('sends the event payload to the stored webhook url', done => {
        let requestOptions;
        const loader = loadWebhookModule({
            db: {
                query: (sql, params, callback) => {
                    assert.ok(sql.includes('SELECT webhook FROM settings'));
                    assert.deepStrictEqual(params, ['ABC123']);
                    callback(null, [{
                        webhook: 'https://example.test/evnotify'
                    }]);
                }
            },
            request: (options, callback) => {
                requestOptions = options;
                callback(null);
            }
        });

        loader.webhook.emit('ABC123', 'secret-token', 'soc', {
            display: 80
        });

        setImmediate(() => {
            loader.restore();

            assert.ok(requestOptions);
            assert.strictEqual(requestOptions.uri, 'https://example.test/evnotify');
            assert.strictEqual(requestOptions.method, 'POST');
            assert.strictEqual(requestOptions.json, true);
            assert.deepStrictEqual(requestOptions.body, {
                akey: 'ABC123',
                token: 'secret-token',
                type: 'soc',
                response: {
                    display: 80
                }
            });
            done();
        });
    });

    it('does not send a request when no webhook is configured', done => {
        let called = false;
        const loader = loadWebhookModule({
            db: {
                query: (sql, params, callback) => callback(null, [{
                    webhook: null
                }])
            },
            request: () => {
                called = true;
            }
        });

        loader.webhook.emit('ABC123', 'secret-token', 'location', {
            lat: 1,
            lng: 2
        });

        setImmediate(() => {
            loader.restore();
            assert.strictEqual(called, false);
            done();
        });
    });
});
