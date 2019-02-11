const chai = require('chai');
const should = chai.should();

const db = require('../../modules/db');
const uut = require('../../modules/cron/createLogs');

describe('createLogs', () => {
    it('does not create new logs on empty table', () => {
        return uut.createLogs().then(res => {
            res.should.deep.include({
                nWrite: 0,
                nRead: 0
            })
        }).then(console.log);
    });

    // TODO: more tests...

    after(() => setTimeout(db.close, 10)); // for some reason we get an exception when we close the pool immediately
});