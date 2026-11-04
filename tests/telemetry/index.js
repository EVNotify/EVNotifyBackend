const assert = require('assert');
const fs = require('fs');
const path = require('path');
const util = require('util');
const mysql = require('mysql');
const express = require('express');
const chai = require('chai');
const chaiHttp = require('chai-http');
const { loadModule } = require('../helpers');
const config = require('../../srv_config.json');

chai.use(chaiHttp);

describe('extended telemetry database and migration', function () {
    this.timeout(20000);
    const database = 'evnotify_telemetry_test_' + process.pid + '_' + Date.now();
    const freshDatabase = database + '_fresh';
    const root = path.resolve(__dirname, '../..');
    const columns = ['battery_cell_voltage_min', 'battery_cell_voltage_max', 'battery_cell_voltage_delta', 'battery_fan_speed'];
    const archiveTables = ['statistics_9_2020', 'statistics_log_102'];
    let connection, query, app, loaders = [];
    let exportedRows;
    let createdDatabase = false, createdFreshDatabase = false;
    const credentials = { akey: 'AAAAAA', token: 'token-a' };
    const migration = async () => {
        const parts = fs.readFileSync(path.join(root, 'modules/db/migrations/extended_vehicle_telemetry.sql'), 'utf8').split(/^DELIMITER .+$/m);
        await query(parts[0]);
        await query(parts[1].replace(/\/\/\s*$/, ''));
        await query(parts[2]);
    };
    const post = body => chai.request(app).post('/extended').send(Object.assign({}, credentials, body));
    const get = auth => chai.request(app).get('/extended').query(auth || credentials);
    const allowHistory = () => query('UPDATE sync SET last_extended=0 WHERE akey=?', ['AAAAAA']);

    before(async () => {
        connection = mysql.createConnection({ host: config.DB_HOST, user: config.DB_USER,
            password: config.DB_PW, multipleStatements: true });
        query = util.promisify(connection.query).bind(connection);
        await query('CREATE DATABASE ??', [database]);
        createdDatabase = true;
        await query('USE ??', [database]);
        await query(fs.readFileSync(path.join(__dirname, 'legacy-schema.sql'), 'utf8'));
        await query("INSERT INTO accounts (akey, pw_hash, token) VALUES ('AAAAAA', 'unused', 'token-a'), ('BBBBBB', 'unused', 'token-b')");
        await query("INSERT INTO sync (user, akey, soh, odo) VALUES ('AAAAAA', 'AAAAAA', 98, 56789), ('BBBBBB', 'BBBBBB', 90, 0)");
        await query("INSERT INTO statistics (akey, timestamp, odo) VALUES ('AAAAAA', 1600000000, 12345)");
        for (const table of archiveTables) {
            await query('CREATE TABLE ?? LIKE statistics', [table]);
            await query('INSERT INTO ?? SELECT * FROM statistics', [table]);
        }
        // A partially applied migration must also be recoverable.
        await query('ALTER TABLE sync ADD COLUMN battery_cell_voltage_min DECIMAL(12,6) DEFAULT NULL');
        await migration();
        const db = { query: connection.query.bind(connection) };
        const token = loadModule('./modules/token', { './modules/db': db, './modules/account': {} });
        const sync = loadModule('./modules/sync', { './modules/db': db, './modules/token': token.module,
            './modules/webhook': { emit: () => {} }, './modules/integrations/abrp': {} });
        const logs = loadModule('./modules/logs', { './modules/db': db, './modules/token': token.module,
            './modules/notification/mail': { validateMail: () => true, simpleSend: () => {} },
            './modules/report': { logExportReport: rows => { exportedRows = rows; return Promise.resolve('unused.xlsx'); } } });
        loaders = [logs, sync, token];
        app = express();
        app.use(express.json());
        app.post('/extended', sync.module.postExtended);
        app.get('/extended', sync.module.getExtended);
        app.get('/logdetail', logs.module.getLog);
        app.get('/logexport', logs.module.exportLog);
    });

    after(async () => {
        loaders.forEach(loader => loader.restore());
        if (connection) {
            try {
                if (createdFreshDatabase) await query('DROP DATABASE ??', [freshDatabase]);
                if (createdDatabase) await query('DROP DATABASE ??', [database]);
            } finally {
                await util.promisify(connection.end).bind(connection)();
            }
        }
    });

    it('migrates both archive formats and preserves old data and unknown measurements', async () => {
        for (const table of ['sync', 'statistics'].concat(archiveTables)) {
            const rows = await query('SELECT * FROM ?? ORDER BY akey', [table]);
            columns.forEach(column => assert.strictEqual(rows[0][column], null));
            assert.strictEqual(rows[0].odo, table === 'sync' ? 56789 : 12345);
            const info = await query('SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME IN (?)', [database, table, columns]);
            assert.strictEqual(info.length, 4);
            info.forEach(col => {
                assert.strictEqual(col.IS_NULLABLE, 'YES');
                assert.strictEqual(col.COLUMN_TYPE, col.COLUMN_NAME === 'battery_fan_speed' ? 'float' : 'decimal(12,6)');
            });
        }
        assert.strictEqual((await query("SELECT odo FROM sync WHERE akey='BBBBBB'"))[0].odo, 0);
        const defaults = await query("SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='sync' AND COLUMN_NAME='odo'", [database]);
        assert.strictEqual(defaults[0].COLUMN_DEFAULT, null);
    });

    it('can rerun without changing data', async () => {
        await query("UPDATE sync SET battery_cell_voltage_min=3.712345 WHERE akey='AAAAAA'");
        await migration();
        assert.strictEqual((await get()).body.battery_cell_voltage_min, 3.712345);
    });

    it('round-trips numeric values, six-place precision, and small deltas through HTTP and MySQL', async () => {
        const response = await post({ batteryCellVoltageMin: 3.7812346, batteryCellVoltageMax: 3.8,
            batteryCellVoltageDelta: 0.02, batteryFanSpeed: 3, odo: 123456 });
        assert.strictEqual(response.status, 200);
        const body = (await get()).body;
        assert.strictEqual(body.battery_cell_voltage_min, 3.781235);
        assert.strictEqual(body.battery_cell_voltage_max, 3.8);
        assert.strictEqual(body.battery_cell_voltage_delta, 0.02);
        assert.strictEqual(body.battery_fan_speed, 3);
        assert.strictEqual(body.odo, 123456);
        await allowHistory();
        assert.strictEqual((await post({ batteryCellVoltageDelta: 0.000001 })).status, 200);
        assert.strictEqual((await get()).body.battery_cell_voltage_delta, 0.000001);
        const history = await query("SELECT * FROM statistics WHERE akey='AAAAAA' ORDER BY id DESC LIMIT 1");
        assert.strictEqual(history[0].battery_cell_voltage_delta, 0.000001);
        assert.strictEqual(history[0].battery_cell_voltage_min, null);
        assert.strictEqual(history[0].odo, null);
    });

    it('supports partial vehicle payloads, zero readings, explicit nulls, and legacy clients', async () => {
        await allowHistory();
        assert.strictEqual((await post({ batteryCellVoltageMin: 0, batteryCellVoltageMax: 0,
            batteryCellVoltageDelta: 0, batteryFanSpeed: 0, odo: 0 })).status, 200);
        let body = (await get()).body;
        columns.concat(['odo']).forEach(column => assert.strictEqual(body[column], 0));
        assert.strictEqual((await post({ soh: 97, dcBatteryCurrent: -10 })).status, 200);
        body = (await get()).body;
        columns.concat(['odo']).forEach(column => assert.strictEqual(body[column], 0));
        assert.strictEqual(body.soh, 97);
        assert.strictEqual((await post({ batteryCellVoltageMin: null, batteryCellVoltageMax: null,
            batteryCellVoltageDelta: null, batteryFanSpeed: null, odo: null })).status, 200);
        body = (await get()).body;
        columns.concat(['odo']).forEach(column => assert.strictEqual(body[column], null));
    });

    it('stores range boundaries without MySQL overflow', async () => {
        assert.strictEqual((await post({ batteryCellVoltageMax: 999999.999999,
            batteryFanSpeed: 3.4028235e38, odo: 2147483647 })).status, 200);
        const body = (await get()).body;
        assert.strictEqual(body.battery_cell_voltage_max, 999999.999999);
        assert.strictEqual(body.odo, 2147483647);
        assert.ok(Number.isFinite(body.battery_fan_speed));
    });

    it('rejects mixed invalid submissions before changing any telemetry', async () => {
        const before = (await get()).body;
        const count = (await query('SELECT COUNT(*) AS n FROM statistics'))[0].n;
        for (const invalid of [{ odo: 1.5 }, { batteryFanSpeed: 3.5e38 }, { batteryCellVoltageMin: '3.7' },
            { batteryCellVoltageMax: 1000000 }, { batteryCellVoltageDelta: -1 }]) {
            assert.strictEqual((await post(Object.assign({ soh: 11 }, invalid))).status, 400);
            assert.deepStrictEqual((await get()).body, before);
        }
        assert.strictEqual((await query('SELECT COUNT(*) AS n FROM statistics'))[0].n, count);
    });

    it('rejects another account token and keeps current state and history scoped', async () => {
        assert.strictEqual((await post({ token: 'token-b', odo: 99 })).status, 401);
        assert.strictEqual((await get({ akey: 'AAAAAA', token: 'token-b' })).status, 401);
        assert.strictEqual((await post({ akey: 'BBBBBB', token: 'token-b', batteryCellVoltageDelta: 0.05 })).status, 200);
        const second = (await get({ akey: 'BBBBBB', token: 'token-b' })).body;
        assert.strictEqual(second.battery_cell_voltage_delta, 0.05);
        assert.strictEqual(second.odo, 0);
        assert.strictEqual((await query("SELECT battery_cell_voltage_delta FROM statistics WHERE akey='BBBBBB'"))[0].battery_cell_voltage_delta, 0.05);
    });

    it('retains the five-second history throttle while updating current measurements', async () => {
        await query("UPDATE sync SET last_extended=? WHERE akey='AAAAAA'", [Math.floor(Date.now() / 1000)]);
        const count = (await query('SELECT COUNT(*) AS n FROM statistics'))[0].n;
        assert.strictEqual((await post({ batteryCellVoltageDelta: 0.02 })).status, 200);
        assert.strictEqual((await get()).body.battery_cell_voltage_delta, 0.02);
        assert.strictEqual((await query('SELECT COUNT(*) AS n FROM statistics'))[0].n, count);
    });

    it('copies current statistics into existing and future archives and exposes them in logdetail', async () => {
        await query('CREATE TABLE statistics_log_104 LIKE statistics');
        await allowHistory();
        await post({ batteryCellVoltageMin: 3.78, batteryCellVoltageMax: 3.8, batteryCellVoltageDelta: 0.02, batteryFanSpeed: 0, odo: 123456 });
        const source = (await query("SELECT * FROM statistics WHERE akey='AAAAAA' ORDER BY id DESC LIMIT 1"))[0];
        const archives = [
            { table: 'statistics', id: 101, delta: 0.02 }, { table: 'statistics_9_2020', id: 103, delta: 0.03 },
            { table: 'statistics_log_102', id: 102, delta: 0.04 }, { table: 'statistics_log_104', id: 104, delta: 0.05 }
        ];
        for (const archive of archives) {
            const table = archive.table;
            const row = Object.assign({}, source, { battery_cell_voltage_delta: archive.delta });
            if (table !== 'statistics') {
                // Match the dynamic named-column copy used by both archive jobs.
                delete row.id;
                row.timestamp = 1600000000;
                await query('INSERT INTO ?? (??) VALUES (?)', [table, Object.keys(row), Object.keys(row).map(key => row[key])]);
            }
            const id = archive.id;
            await query('INSERT INTO logs (id, akey, start, end, archived, standalone) VALUES (?, ?, ?, ?, ?, ?)',
                [id, 'AAAAAA', row.timestamp, row.timestamp, table === 'statistics' ? 0 : 1, table.startsWith('statistics_log_') ? 1 : 0]);
            const res = await chai.request(app).get('/logdetail').query(Object.assign({ id: id }, credentials));
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.stats.some(stat => stat.battery_cell_voltage_delta === archive.delta && stat.battery_fan_speed === 0));
            assert.strictEqual((await chai.request(app).get('/logdetail').query({ id: id, akey: 'BBBBBB', token: 'token-b' })).status, 422);
            exportedRows = null;
            const exportResponse = await chai.request(app).get('/logexport').query(Object.assign({ id: id, email: 'test@example.com' }, credentials));
            assert.strictEqual(exportResponse.status, 200);
            assert.ok(exportedRows.some(stat => stat.battery_cell_voltage_delta === archive.delta && stat.battery_fan_speed === 0));
        }
    });

    it('creates fresh schemas with the same nullable telemetry and odometer default', async () => {
        await query('CREATE DATABASE ??', [freshDatabase]);
        createdFreshDatabase = true;
        await query('USE ??', [freshDatabase]);
        try {
            await query(fs.readFileSync(path.join(root, 'modules/db/db_template.sql'), 'utf8'));
            const info = await query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('sync', 'statistics') AND COLUMN_NAME IN (?)", [freshDatabase, columns.concat(['odo'])]);
            assert.strictEqual(info.length, 10);
            info.forEach(column => assert.strictEqual(column.COLUMN_DEFAULT, null));
        } finally {
            await query('USE ??', [database]);
        }
    });
});
