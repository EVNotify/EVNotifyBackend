const assert = require('assert');
const { loadModule } = require('../helpers');

describe('webhook module', () => {
    let loader;
    let requests;
    let destination;
    let rows;
    let dbError;
    let transportError;
    let loggedErrors;
    let originalConsoleError;

    beforeEach(() => {
        requests = [];
        destination = 'https://example.test/evnotify';
        rows = undefined;
        dbError = null;
        transportError = null;
        loggedErrors = [];
        originalConsoleError = console.error;
        console.error = err => loggedErrors.push(err);
        loader = loadModule('./modules/webhook', {
            './modules/db': {
                query: (sql, params, callback) => {
                    assert.ok(sql.includes('SELECT webhook FROM settings'));
                    assert.deepStrictEqual(params, ['ABC123']);
                    callback(dbError, rows === undefined ? [{ webhook: destination }] : rows);
                }
            },
            request: (options, callback) => {
                requests.push(options);
                callback(transportError);
            }
        });
    });

    afterEach(() => {
        console.error = originalConsoleError;
        if (loader) loader.restore();
    });

    const emit = response => loader.module.emit('ABC123', 'secret-token', 'extended', response);

    it('posts to the stored URL and preserves event data without forwarding credentials', () => {
        emit({ soh: 98 });
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].uri, destination);
        assert.strictEqual(requests[0].method, 'POST');
        assert.strictEqual(requests[0].json, true);
        assert.strictEqual(requests[0].timeout, 10000);
        assert.deepStrictEqual(requests[0].body, {
            akey: 'ABC123', type: 'extended', response: { soh: 98 }
        });
    });

    [
        'https://evnotify.de/hook',
        'https://evnotify.com/hook',
        'https://api.evnotify.de/hook',
        'https://api.evnotify.com/hook',
        'https://nested.api.evnotify.de/hook',
        'https://nested.api.evnotify.com/hook',
        'https://API.EVNOTIFY.DE/hook',
        'https://API.EVNOTIFY.COM/hook',
        'https://evnotify.de:443/hook',
        'https://attacker.com@evnotify.de/hook'
    ].forEach(url => {
        it('sends the token once and prevents redirects for ' + url, () => {
            destination = url;
            const response = Object.freeze({ akey: 'ABC123', token: 'secret-token', soh: 98 });
            emit(response);
            assert.strictEqual(requests[0].body.token, 'secret-token');
            assert.deepStrictEqual(requests[0].body.response, { akey: 'ABC123', soh: 98 });
            assert.strictEqual(requests[0].followRedirect, false);
            assert.strictEqual(requests[0].followAllRedirects, false);
            assert.strictEqual(response.token, 'secret-token');
        });
    });

    [
        'http://evnotify.de/hook',
        'http://api.evnotify.com/hook',
        'https://fakeevnotify.de/hook',
        'https://fakeevnotify.com/hook',
        'https://evnotify.de.attacker.com/hook',
        'https://evnotify.com.attacker.de/hook',
        'https://evnotify.de.com/hook',
        'https://evnotify.com.de/hook',
        'https://evnotify.dev/hook',
        'https://evnotify.company/hook',
        'https://api.evnotify.de.attacker.com/hook',
        'https://evnotify.de@attacker.com/hook',
        'https://evnotify.com:password@attacker.com/hook',
        'https://example.test/evnotify.de?domain=evnotify.com',
        'https://evnotify.de./hook',
        'not a URL'
    ].forEach(url => {
        it('omits both token fields for ' + url, () => {
            destination = url;
            const response = Object.freeze({ token: 'secret-token', soh: 98 });
            emit(response);
            assert.ok(!Object.prototype.hasOwnProperty.call(requests[0].body, 'token'));
            assert.deepStrictEqual(requests[0].body.response, { soh: 98 });
            assert.strictEqual(response.token, 'secret-token');
        });
    });

    [null, ''].forEach(url => {
        it('does not send when the configured URL is ' + JSON.stringify(url), () => {
            destination = url;
            emit({});
            assert.strictEqual(requests.length, 0);
        });
    });

    [[], null].forEach(result => {
        it('does not send when settings lookup returns ' + JSON.stringify(result), () => {
            rows = result;
            emit({});
            assert.strictEqual(requests.length, 0);
        });
    });

    it('does not send on database lookup failure', () => {
        dbError = new Error('lookup failed');
        emit({});
        assert.strictEqual(requests.length, 0);
    });

    it('preserves array response payloads', () => {
        emit([1, 2]);
        assert.deepStrictEqual(requests[0].body.response, [1, 2]);
    });

    it('logs transport errors without throwing', () => {
        transportError = new Error('connection timed out');
        assert.doesNotThrow(() => emit({}));
        assert.deepStrictEqual(loggedErrors, [transportError]);
    });
});
