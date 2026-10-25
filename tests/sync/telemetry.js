const assert = require('assert');
const { loadModule, createResponse } = require('../helpers');
const errors = require('../../srv_errors.json');

describe('extended telemetry validation and sparse writes', () => {
    let loader, queries, events, recent, selected;
    const measurements = {
        batteryCellVoltageMin: 3.78, batteryCellVoltageMax: 3.8,
        batteryCellVoltageDelta: 0.02, batteryFanSpeed: 3, odo: 123456
    };
    const names = {
        batteryCellVoltageMin: 'battery_cell_voltage_min', batteryCellVoltageMax: 'battery_cell_voltage_max',
        batteryCellVoltageDelta: 'battery_cell_voltage_delta', batteryFanSpeed: 'battery_fan_speed', odo: 'odo'
    };
    const invoke = data => {
        const res = createResponse();
        loader.module.postExtended({ body: Object.assign({ akey: 'ABC123', token: 'secret' }, data) }, res);
        return res;
    };
    const assignments = query => {
        const columns = query.sql.match(/SET (.+) WHERE/)[1].split(', ').map(s => s.split('=')[0]);
        return columns.reduce((values, column, i) => Object.assign(values, { [column]: query.params[i] }), {});
    };

    beforeEach(() => {
        queries = []; events = []; recent = false; selected = null;
        loader = loadModule('./modules/sync', {
            './modules/db': { query: (sql, params, cb) => {
                queries.push({ sql, params });
                cb(null, sql.startsWith('SELECT') ? [selected || { last_extended: recent ? Math.floor(Date.now() / 1000) : 0 }] : { affectedRows: 1 });
            } },
            './modules/token': { validateToken: (akey, token, cb) => cb(null, true) },
            './modules/webhook': { emit: (...args) => events.push(args) },
            './modules/integrations/abrp': {}
        });
    });
    afterEach(() => loader.restore());

    it('maps every supplied measurement into current state and sparse history', () => {
        assert.strictEqual(invoke(measurements).statusCode, 200);
        const update = assignments(queries[1]);
        Object.keys(names).forEach(field => {
            assert.strictEqual(update[names[field]], measurements[field]);
            assert.ok(queries[2].sql.includes(names[field]));
        });
        assert.ok(!queries[1].sql.includes('soh='));
        assert.ok(!queries[2].sql.includes('soh'));
        assert.strictEqual(queries[1].params.slice(-1)[0], 'ABC123');
        assert.strictEqual(queries[2].params.slice(-1)[0], 'ABC123');
        assert.strictEqual(events.length, 1);
    });

    [0, null].forEach(value => it('preserves all five ' + value + ' values', () => {
        const data = Object.keys(names).reduce((body, field) => Object.assign(body, { [field]: value }), {});
        assert.strictEqual(invoke(data).statusCode, 200);
        const update = assignments(queries[1]);
        Object.keys(names).forEach(field => assert.strictEqual(update[names[field]], value));
        assert.strictEqual(queries[2].params.filter(v => v === value).length, 5);
    }));

    it('preserves omitted legacy fields, ignores unknown fields, and rounds voltages', () => {
        assert.strictEqual(invoke({ batteryCellVoltageDelta: 0.0000126, unexpected: 42 }).statusCode, 200);
        assert.deepStrictEqual(Object.keys(assignments(queries[1])), ['battery_cell_voltage_delta', 'last_extended']);
        assert.strictEqual(queries[1].params[0], 0.000013);
        assert.strictEqual(queries[2].params[0], 0.000013);
        assert.ok(!queries[1].sql.includes('unexpected'));
    });

    it('keeps old payloads valid and only updates submitted legacy fields', () => {
        assert.strictEqual(invoke({ soh: 0, dcBatteryCurrent: -12 }).statusCode, 200);
        assert.strictEqual(assignments(queries[1]).soh, 0);
        assert.strictEqual(assignments(queries[1]).dc_battery_current, -12);
        assert.ok(!queries[1].sql.includes('odo='));
        assert.ok(!queries[2].sql.includes('battery_cell'));
    });

    it('keeps credential-only payloads valid without clearing any measurements', () => {
        assert.strictEqual(invoke({}).statusCode, 200);
        assert.deepStrictEqual(Object.keys(assignments(queries[1])), ['last_extended']);
        assert.ok(queries[2].sql.includes('(timestamp, akey)'));
    });

    it('updates current measurements but retains the five-second history throttle', () => {
        recent = true;
        assert.strictEqual(invoke(measurements).statusCode, 200);
        assert.strictEqual(queries.length, 2);
        assert.strictEqual(events.length, 1);
    });

    Object.keys(names).forEach(field => {
        ['3.8', true, false, [], {}, undefined, NaN, Infinity, -Infinity, -0.1].forEach(value => {
            it('rejects ' + field + '=' + String(value) + ' before writes or events', () => {
                const res = invoke(Object.assign({}, measurements, { [field]: value }));
                assert.strictEqual(res.statusCode, 400);
                assert.deepStrictEqual(res.body.error, errors.INVALID_PARAMETERS);
                assert.deepStrictEqual(queries, []);
                assert.deepStrictEqual(events, []);
            });
        });
    });

    [
        { odo: 0.5 }, { odo: 2147483648 }, { batteryFanSpeed: 3.5e38 },
        { batteryCellVoltageMin: 1000000 }, { batteryCellVoltageMax: 1000000 },
        { batteryCellVoltageDelta: 1000000 }
    ].forEach(data => it('rejects out-of-storage-range input ' + JSON.stringify(data), () => {
        assert.strictEqual(invoke(data).statusCode, 400);
        assert.deepStrictEqual(queries, []);
    }));

    it('accepts storage boundaries', () => {
        assert.strictEqual(invoke({ odo: 2147483647, batteryCellVoltageMax: 999999.999999, batteryFanSpeed: 3.4028234663852886e38 }).statusCode, 200);
    });

    it('normalizes fan values to their finite FLOAT representation before SQL', () => {
        assert.strictEqual(invoke({ batteryFanSpeed: 3.4028235e38 }).statusCode, 200);
        assert.strictEqual(assignments(queries[1]).battery_fan_speed, Math.fround(3.4028235e38));
    });

    it('serializes selected decimals as numbers and preserves nulls and zeros', () => {
        selected = { battery_cell_voltage_min: '3.780000', battery_cell_voltage_max: null,
            battery_cell_voltage_delta: '0.000000', battery_fan_speed: 0, odo: 123456, last_extended: 123 };
        const res = createResponse();
        loader.module.getExtended({ query: { akey: 'ABC123', token: 'secret' } }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.battery_cell_voltage_min, 3.78);
        assert.strictEqual(res.body.battery_cell_voltage_delta, 0);
        assert.strictEqual(res.body.battery_cell_voltage_max, null);
        assert.ok(queries[0].sql.includes('battery_fan_speed'));
        assert.deepStrictEqual(queries[0].params, ['ABC123']);
    });
});
