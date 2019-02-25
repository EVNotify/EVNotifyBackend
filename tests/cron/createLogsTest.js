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
        });
    });

    // TODO: more tests...

    after(db.close);
});
