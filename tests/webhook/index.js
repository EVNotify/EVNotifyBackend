const assert = require('assert');
const { loadModule } = require('../helpers');
const realRequest = require('request');
const fs = require('fs');
const path = require('path');
const https = require('https');

describe('webhook module', () => {
    let loader;
    let requests;
    let destination;
    let rows;
    let dbError;
    let transportError;
    let synchronousError;
    let loggedErrors;
    let originalConsoleError;
    let dnsAddresses;
    let dnsError;
    let dnsQueries;
    let deferredLookup;
    let dnsCallback;
    let timeoutCallback;
    let timeoutCleared;

    beforeEach(() => {
        requests = [];
        destination = 'https://example.test/evnotify';
        rows = undefined;
        dbError = null;
        transportError = null;
        synchronousError = null;
        dnsAddresses = [{ address: '8.8.8.8', family: 4 }];
        dnsError = null;
        dnsQueries = [];
        deferredLookup = false;
        timeoutCleared = false;
        timeoutCallback = null;
        loggedErrors = [];
        originalConsoleError = console.error;
        console.error = err => loggedErrors.push(err);
        loader = loadModule('./modules/webhook', {
            dns: { lookup: (hostname, options, callback) => {
                dnsQueries.push(hostname);
                assert.deepStrictEqual(options, { all: true });
                dnsCallback = callback;
                if (!deferredLookup) callback(dnsError, dnsAddresses);
            } },
            timers: {
                setTimeout: (callback, delay) => {
                    assert.strictEqual(delay, 10000);
                    timeoutCallback = callback;
                    return 1;
                },
                clearTimeout: () => { timeoutCleared = true; }
            },
            './modules/db': {
                query: (sql, params, callback) => {
                    assert.ok(sql.includes('SELECT webhook FROM settings'));
                    assert.deepStrictEqual(params, ['ABC123']);
                    callback(dbError, rows === undefined ? [{ webhook: destination }] : rows);
                }
            },
            request: (options, callback) => {
                if (synchronousError) throw synchronousError;
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

    [
        '0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255',
        '192.168.1.1', '169.254.169.254', '100.100.100.200', '198.18.0.1',
        '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1',
        '255.255.255.255', '127.1', '2130706433', '0x7f000001', '0177.0.0.1',
        '[::]', '[::1]', '[fc00::1]', '[fd00::1]', '[fe80::1]', '[ff02::1]',
        '[::ffff:127.0.0.1]', '[::ffff:10.0.0.1]', '[::ffff:169.254.169.254]',
        '[64:ff9b::a00:1]', '[2002:0a00:0001::1]', '[2001::1]',
        '[2001:db8::1]', '[3fff::1]', '[4000::1]'
    ].forEach(host => {
        it('blocks non-public literal address ' + host, () => {
            destination = 'https://' + host + '/hook';
            assert.doesNotThrow(() => emit({}));
            assert.strictEqual(requests.length, 0);
            assert.strictEqual(dnsQueries.length, 0);
            assert.strictEqual(loggedErrors.length, 1);
        });
    });

    ['8.8.8.8', '[2606:4700:4700::1111]', '[::ffff:8.8.8.8]'].forEach(host => {
        it('allows public literal address ' + host, () => {
            destination = 'https://' + host + '/hook';
            emit({});
            assert.strictEqual(requests.length, 1);
            assert.strictEqual(dnsQueries.length, 0);
        });
    });

    [
        [{ address: '127.0.0.1', family: 4 }],
        [{ address: '10.0.0.1', family: 4 }],
        [{ address: '169.254.169.254', family: 4 }],
        [{ address: '::1', family: 6 }],
        [{ address: 'fd00::1', family: 6 }],
        [{ address: '::ffff:192.168.1.1', family: 6 }],
        [{ address: 'fe80::1%eth0', family: 6 }],
        [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }],
        [{ address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 }],
        [{ address: 'not-an-address', family: 4 }],
        [{ address: '8.8.8.8', family: 6 }]
    ].forEach(addresses => {
        it('blocks unsafe or mixed DNS answers ' + JSON.stringify(addresses), () => {
            dnsAddresses = addresses;
            emit({});
            assert.strictEqual(requests.length, 0);
            assert.strictEqual(loggedErrors[0].message, 'Blocked webhook destination');
            assert.strictEqual(timeoutCleared, true);
        });
    });

    [[], null].forEach(addresses => {
        it('skips empty DNS answers ' + JSON.stringify(addresses), () => {
            dnsAddresses = addresses;
            emit({});
            assert.strictEqual(requests.length, 0);
            assert.strictEqual(loggedErrors[0].message, 'Webhook DNS lookup failed');
        });
    });

    it('logs DNS failures without leaking resolver error details', () => {
        dnsError = new Error('secret URL credentials');
        emit({});
        assert.strictEqual(requests.length, 0);
        assert.strictEqual(loggedErrors[0].message, 'Webhook DNS lookup failed');
    });

    it('times out DNS lookup and ignores late answers', () => {
        deferredLookup = true;
        emit({});
        assert.strictEqual(requests.length, 0);
        timeoutCallback();
        dnsCallback(null, dnsAddresses);
        assert.strictEqual(requests.length, 0);
        assert.strictEqual(loggedErrors.length, 1);
        assert.strictEqual(loggedErrors[0].message, 'Webhook DNS lookup timed out');
    });

    it('pins the checked address without a second DNS lookup', () => {
        emit({});
        dnsAddresses = [{ address: '127.0.0.1', family: 4 }];
        const options = requests[0];
        options.lookup('example.test', {}, (err, address, family) => {
            assert.ifError(err);
            assert.strictEqual(address, '8.8.8.8');
            assert.strictEqual(family, 4);
        });
        options.lookup('example.test', { all: true }, (err, addresses) => {
            assert.ifError(err);
            assert.deepStrictEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
        });
        options.lookup('attacker.test', {}, err => assert.ok(err));
        assert.deepStrictEqual(dnsQueries, ['example.test']);
        assert.strictEqual(options.proxy, null);
        assert.strictEqual(options.pool, false);
        assert.strictEqual(options.followRedirect, false);
        assert.strictEqual(options.followAllRedirects, false);
    });

    it('pins a public IPv6 DNS answer', () => {
        dnsAddresses = [{ address: '2606:4700:4700::1111', family: 6 }];
        emit({});
        requests[0].lookup('example.test', (err, address, family) => {
            assert.ifError(err);
            assert.strictEqual(address, dnsAddresses[0].address);
            assert.strictEqual(family, 6);
        });
        assert.strictEqual(requests[0].family, 6);
    });

    [
        'not a URL', 'http://[', 'https://%ZZ@example.com/hook',
        'https://', '/relative/hook', '//example.com/hook',
        'ftp://example.com/hook', 'file:///tmp/hook',
        'https://example.com:65536/hook', 'https://example.com:abc/hook',
        'https://example.com/white space', 'https://example.com/\nheader',
        'http://unix:/tmp/service.sock:/hook', 123, {}
    ].forEach(url => {
        it('skips invalid URL ' + JSON.stringify(url) + ' without throwing', () => {
            destination = url;
            assert.doesNotThrow(() => emit({}));
            assert.strictEqual(requests.length, 0);
            assert.strictEqual(loggedErrors.length, 1);
            assert.strictEqual(loggedErrors[0].message, 'Invalid webhook URL; delivery skipped');
        });
    });

    [
        'http://example.test/hook',
        'HTTP://example.test/hook',
        'http://evnotify.de/hook',
        'http://api.evnotify.com/hook'
    ].forEach(url => {
        it('rejects HTTP before DNS lookup or delivery for ' + url, () => {
            destination = url;
            assert.doesNotThrow(() => emit({ token: 'secret-token' }));
            assert.deepStrictEqual(dnsQueries, []);
            assert.deepStrictEqual(requests, []);
            assert.strictEqual(loggedErrors.length, 1);
            assert.strictEqual(loggedErrors[0].message, 'Invalid webhook URL; delivery skipped');
        });
    });

    it('accepts a case-insensitive HTTPS scheme', () => {
        destination = 'HTTPS://example.test/hook';
        emit({});
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(requests[0].uri, 'https://example.test/hook');
    });

    it('logs synchronous delivery errors without throwing', () => {
        synchronousError = new Error('request construction failed');
        assert.doesNotThrow(() => emit({}));
        assert.strictEqual(loggedErrors[0].message, 'Webhook delivery failed');
    });

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
        assert.strictEqual(loggedErrors[0].message, 'Webhook delivery failed');
    });
});

describe('webhook HTTPS transport protection', () => {
    let loader;
    let server;
    let originalHttpsConnect;

    afterEach(done => {
        if (loader) loader.restore();
        if (originalHttpsConnect) https.Agent.prototype.createConnection = originalHttpsConnect;
        if (server) server.close(done);
        else done();
        loader = null;
        server = null;
        originalHttpsConnect = null;
    });

    it('uses the pinned lookup with real HTTPS, preserves Host, and does not follow redirects', done => {
        let received = 0;
        let lookups = 0;
        let pinnedLookups = 0;
        const cert = fs.readFileSync(path.join(__dirname, 'fixtures/server-cert.pem'));
        const key = fs.readFileSync(path.join(__dirname, 'fixtures/server-key.pem'));
        server = https.createServer({ cert, key }, (req, res) => {
            received++;
            req.resume();
            res.writeHead(302, { Location: 'http://127.0.0.1:' + server.address().port + '/internal' });
            res.end();
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.on('request', req => assert.strictEqual(req.headers.host, 'example.test:' + port));
            loader = loadModule('./modules/webhook', {
                './modules/db': { query: (sql, params, cb) => cb(null, [{ webhook: 'https://example.test:' + port + '/hook' }]) },
                dns: { lookup: (hostname, options, cb) => {
                    lookups++;
                    cb(null, [{ address: '8.8.8.8', family: 4 }]);
                } },
                request: (options, callback) => {
                    // Route the approved public address to a local fixture only in this test.
                    // The real request library must pass our lookup through to Node's socket.
                    options.ca = cert; // Trust only the fixture certificate; keep TLS verification enabled.
                    const lookup = options.lookup;
                    options.lookup = (hostname, lookupOptions, cb) => {
                        pinnedLookups++;
                        lookup(hostname, lookupOptions, (err, address, family) => {
                            assert.ifError(err);
                            if (lookupOptions.all) {
                                assert.deepStrictEqual(address, [{ address: '8.8.8.8', family: 4 }]);
                                cb(null, [{ address: '127.0.0.1', family: 4 }]);
                            } else {
                                assert.strictEqual(address, '8.8.8.8');
                                cb(null, '127.0.0.1', family);
                            }
                        });
                    };
                    return realRequest(options, (err, response) => {
                        callback(err);
                        try {
                            assert.ifError(err);
                            assert.strictEqual(response.statusCode, 302);
                            assert.strictEqual(received, 1);
                            assert.strictEqual(lookups, 1);
                            assert.strictEqual(pinnedLookups, 1);
                            done();
                        } catch (failure) { done(failure); }
                    });
                }
            });
            loader.module.emit('ABC123', 'secret-token', 'soc', { display: 80 });
        });
    });

    it('preserves TLS servername and certificate verification with a pinned address', done => {
        originalHttpsConnect = https.Agent.prototype.createConnection;
        const expectedError = new Error('test stops connection before network access');
        let connectionOptions;
        https.Agent.prototype.createConnection = (options, callback) => {
            connectionOptions = options;
            process.nextTick(() => callback(expectedError));
        };
        loader = loadModule('./modules/webhook', {
            './modules/db': { query: (sql, params, cb) => cb(null, [{ webhook: 'https://example.test/hook' }]) },
            dns: { lookup: (hostname, options, cb) => cb(null, [{ address: '8.8.8.8', family: 4 }]) },
            request: options => realRequest(options, err => {
                // Expected connection failure belongs to the fixture, not webhook delivery.
                try {
                    assert.strictEqual(err, expectedError);
                    assert.strictEqual(connectionOptions.servername, 'example.test');
                    assert.notStrictEqual(connectionOptions.rejectUnauthorized, false);
                    connectionOptions.lookup('example.test', {}, (lookupError, address) => {
                        assert.ifError(lookupError);
                        assert.strictEqual(address, '8.8.8.8');
                    });
                    done();
                } catch (failure) { done(failure); }
            })
        });
        loader.module.emit('ABC123', 'secret-token', 'soc', { display: 80 });
    });
});
