const db = require('..');
const path = require('path');
const fs = require('fs')

fs.readdir(".", function (err, files) {
    if (err) {
        return console.err('Unable to scan directory: ' + err);
    }
    var max = files.reduce((prev, file) => {
        var part = file.split(".")[0];
        if (!isNaN(part)) {
            return Math.max(prev, parseInt(part));
        }
        return prev;
    }, 0);
    if (!max) return console.error('did not find any upgrade files in current directory');

    db.getConnection((err, connection) => {
        if (err) {
            connection.release();
            console.error('unable to get connection', err);
            return;
        }
        connection.doQuery = require('util').promisify(connection.query);
        connection.doBeginTransaction = require('util').promisify(connection.beginTransaction);
        connection.doBeginTransaction()
            .then(() => connection.doQuery('CREATE TABLE IF NOT EXISTS `system` (`key` VARCHAR(20) NOT NULL PRIMARY KEY, `value` VARCHAR(20) NOT NULL)'))
            .then(() => connection.doQuery('SELECT value FROM system WHERE "key"="version"'))
            .then(res => res.length == 0 ? 0 : res.value)
            .then(currentVersion => [...Array(max - currentVersion)].reduce((p, _, i) => p.then(() => {
                const content = fs.readFileSync((1 + i + currentVersion) + ".sql", "utf-8");
                var queries = content.replace(/[\r\n]+/g, ' ').split(";");
                return queries.reduce((p, q) => p.then(() => connection.doQuery(q)), Promise.resolve());
            }), Promise.resolve()))
            .then(connection.commit())
            .catch(err => {
                connection.rollback();
                console.error(err);
            })
            .then(() => connection.release())
            .then(() => db.close());
    });
});
