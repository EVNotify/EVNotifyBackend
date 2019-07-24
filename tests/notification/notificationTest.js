const chai = require('chai');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const db = require('../../modules/db');
const uut = require('../../modules/notification');
const encryption = require('../../modules/encryption')
const webhook = require('../../modules/webhook');
const mail = require('../../modules/notification/mail');
const telegram = require('../../modules/notification/telegram');
const push = require('../../modules/notification/push')

const doQuery = require('util').promisify(db.query);
const clearAll = () => {
    return Promise.all(['sync', 'statistics', 'settings', 'qr', 'notificationMail', 'mailLock', 'logs', 'login', 'devices', 'debug'].map(e => doQuery('DELETE FROM ' + e))).then(() => doQuery('DELETE FROM accounts'));
}
var encryptedTestMail = encryption.encrypt('test@example.com')

var reqA = { body: { akey: '123456', token: '3', abort: false } };
var reqB = { body: { akey: '234567', token: '6', abort: false } };
var req, res;

describe('test notification sending', () => {
    beforeEach('clear db', clearAll);
    beforeEach('create accounts', () => doQuery('INSERT INTO accounts VALUES(123456,1,2,3),(234567,4,5,6)'));
    beforeEach('create empty syncs', () => doQuery('INSERT INTO sync(user,akey) VALUES(123456,123456),(234567,234567)'));
    beforeEach('create empty settings', () => doQuery('INSERT INTO settings(user,akey) VALUES(123456,123456),(234567,234567)'));
    beforeEach('create stubs', () => {
        sandbox.stub(mail, 'sendMail').returns(null);
        sandbox.stub(telegram, 'sendMessage');
        sandbox.stub(push, 'sendPush');
        sandbox.stub(webhook, 'emit');
        req = {};
        res = () => { };
    })

    describe('mail notifications', () => {
        it('sends mail if present and verified', done => {
            req = reqA;
            res = {
                json: () => {
                    sinon.assert.calledWith(mail.sendMail, sinon.match.has("email", encryptedTestMail), false);
                    done();
                }
            };

            doQuery('INSERT INTO notificationMail(akey, mail, verified, identifier) VALUES(123456,?, TRUE, UNHEX("1234567890abcdef1234567890abcdef"))', [encryptedTestMail])
                .then(() => uut.send(req, res));
        });

        it('does not send if not verified', done => {
            req = reqA;
            res = {
                json: () => {
                    sinon.assert.notCalled(mail.sendMail);
                    done();
                }
            };

            doQuery('INSERT INTO notificationMail(akey, mail, verified, identifier) VALUES(123456,?, FALSE, UNHEX("1234567890abcdef1234567890abcdef"))', [encryptedTestMail])
                .then(() => uut.send(req, res));
        });

        it('does not send if no address', done => {
            req = reqA;
            res = {
                json: () => {
                    sinon.assert.notCalled(mail.sendMail);
                    done();
                }
            };

            uut.send(req, res);
        });
    });

    afterEach("restore sandbox", () => sandbox.restore());
});