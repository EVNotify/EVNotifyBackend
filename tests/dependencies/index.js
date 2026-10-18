const assert = require('assert');
const path = require('path');

describe('patched dependency compatibility', () => {
    it('preserves Mocha argument parsing with nested options and repeated flags', () => {
        const unparse = require('yargs-unparser');
        assert.deepStrictEqual(unparse({
            _: ['tests/sync'],
            reporter: 'dot',
            config: { color: true, retries: 2 },
            require: ['first', 'second']
        }), ['tests/sync', '--reporter', 'dot', '--config.color', '--config.retries', '2',
            '--require', 'first', '--require', 'second']);
    });

    it('blocks prototype pollution through the flat dependency used by Mocha', () => {
        const parserDirectory = path.dirname(require.resolve('yargs-unparser'));
        const flat = require(require.resolve('flat', { paths: [parserDirectory] }));
        try {
            flat.unflatten({ '__proto__.evnotifyPolluted': true });
            assert.strictEqual({}.evnotifyPolluted, undefined);
        } finally {
            delete Object.prototype.evnotifyPolluted;
        }
    });

    it('loads Rookout and preserves its SHA256 source hashing', () => {
        const rookout = require('rookout');
        const rookoutDirectory = path.dirname(require.resolve('rookout'));
        const sha256 = require(require.resolve('crypto-js/sha256', { paths: [rookoutDirectory] }));
        assert.strictEqual(typeof rookout.start, 'function');
        assert.strictEqual(sha256('abc').toString(),
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('constructs a mail transport and serializes notification messages', done => {
        const transport = require('nodemailer').createTransport({ jsonTransport: true });
        transport.sendMail({
            from: 'from@example.test', to: 'to@example.test', subject: 'Charge complete', html: '<p>80%</p>'
        }, (err, info) => {
            if (err) return done(err);
            try {
                const message = JSON.parse(info.message);
                assert.strictEqual(message.subject, 'Charge complete');
                assert.strictEqual(message.html, '<p>80%</p>');
                assert.strictEqual(message.to[0].address, 'to@example.test');
                done();
            } catch (failure) { done(failure); }
        });
    });
});
