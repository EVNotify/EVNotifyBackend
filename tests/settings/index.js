/**
 * @file tests/settings/index.js
 * @author GPlay97
 * @description Tests for settings module
 */
const assert = require('assert');
const path = require('path');
const srv_errors = require('./../../srv_errors.json');

const createResponse = onJson => ({
    statusCode: 200,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        onJson(this.statusCode, payload);
    }
});

const loadSettingsModule = stubs => {
    const modulePath = path.resolve(__dirname, './../../modules/settings');
    const resolvedModulePath = require.resolve(modulePath);
    const dbPath = require.resolve(path.resolve(__dirname, './../../modules/db'));
    const tokenPath = require.resolve(path.resolve(__dirname, './../../modules/token'));
    const encryptionPath = require.resolve(path.resolve(__dirname, './../../modules/encryption'));
    const replacements = [
        [dbPath, stubs.db],
        [tokenPath, stubs.token],
        [encryptionPath, stubs.encryption]
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

    const settings = require(modulePath);

    return {
        settings,
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

describe('settings module', () => {
    it('returns the webhook setting in getSettings', done => {
        const loader = loadSettingsModule({
            db: {
                query: (sql, params, callback) => {
                    assert.ok(sql.includes('summary, webhook FROM settings'));
                    assert.deepStrictEqual(params, ['ABC123']);
                    callback(null, [{
                        email: 'encrypted-mail',
                        webhook: 'https://example.test/evnotify',
                        summary: 1
                    }]);
                }
            },
            token: {
                validateToken: (akey, token, callback) => {
                    assert.strictEqual(akey, 'ABC123');
                    assert.strictEqual(token, 'secret-token');
                    callback(null, true);
                }
            },
            encryption: {
                decrypt: value => {
                    assert.strictEqual(value, 'encrypted-mail');
                    return 'user@example.com';
                },
                encrypt: value => value
            }
        });

        loader.settings.getSettings({
            query: {
                akey: 'ABC123',
                token: 'secret-token'
            }
        }, createResponse((statusCode, payload) => {
            loader.restore();
            assert.strictEqual(statusCode, 200);
            assert.strictEqual(payload.settings.email, 'user@example.com');
            assert.strictEqual(payload.settings.webhook, 'https://example.test/evnotify');
            done();
        }));
    });

    it('persists the webhook setting in setSettings', done => {
        let queryValues;
        const loader = loadSettingsModule({
            db: {
                query: (sql, params, callback) => {
                    assert.ok(sql.includes('summary=?, webhook=? WHERE akey=?'));
                    queryValues = params;
                    callback(null, [{}]);
                }
            },
            token: {
                validateToken: (akey, token, callback) => {
                    assert.strictEqual(akey, 'ABC123');
                    assert.strictEqual(token, 'secret-token');
                    callback(null, true);
                }
            },
            encryption: {
                decrypt: value => value,
                encrypt: value => 'enc:' + value
            }
        });
        const requestBody = {
            akey: 'ABC123',
            token: 'secret-token',
            settings: {
                email: 'user@example.com',
                telegram: 0,
                push: 1,
                soc: 20,
                consumption: 17,
                capacity: 64,
                car: 'ioniq',
                device: 'android',
                lng: 'en',
                summary: 1,
                webhook: 'https://example.test/evnotify'
            }
        };

        loader.settings.setSettings({
            body: requestBody
        }, createResponse((statusCode, payload) => {
            loader.restore();
            assert.strictEqual(statusCode, 200);
            assert.strictEqual(queryValues[0], 'enc:user@example.com');
            assert.strictEqual(queryValues[10], 'https://example.test/evnotify');
            assert.strictEqual(queryValues[11], 'ABC123');
            assert.strictEqual(payload.settings.webhook, 'https://example.test/evnotify');
            done();
        }));
    });

    it('rejects missing settings payloads', done => {
        const loader = loadSettingsModule({
            db: {
                query: () => {
                    throw new Error('db should not be called');
                }
            },
            token: {
                validateToken: () => {
                    throw new Error('token should not be called');
                }
            },
            encryption: {
                decrypt: value => value,
                encrypt: value => value
            }
        });

        loader.settings.setSettings({
            body: {
                akey: 'ABC123',
                token: 'secret-token'
            }
        }, createResponse((statusCode, payload) => {
            loader.restore();
            assert.strictEqual(statusCode, 400);
            assert.deepStrictEqual(payload.error, srv_errors.INVALID_PARAMETERS);
            done();
        }));
    });
});
