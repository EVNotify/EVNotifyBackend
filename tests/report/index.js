const assert = require('assert');
const fs = require('fs');
const util = require('util');
const JSZip = require('jszip');
const { loadModule, createResponse } = require('../helpers');
const translation = require('../../modules/translation');

describe('extended telemetry XLSX exports', () => {
    let loader;
    beforeEach(() => {
        loader = loadModule('./modules/report', { './modules/db': {}, './modules/token': {} });
    });
    afterEach(() => loader.restore());

    it('writes numeric measurements, real zeros, unit headers, and blank unknown cells', async () => {
        const file = await loader.module.logExportReport([
            { timestamp: 1600000000, battery_cell_voltage_min: '3.780000', battery_cell_voltage_max: 3.8,
                battery_cell_voltage_delta: '0.020000', battery_fan_speed: 3, odo: 123456 },
            { timestamp: 1600000001, battery_cell_voltage_min: 0, battery_cell_voltage_max: 0,
                battery_cell_voltage_delta: 0, battery_fan_speed: 0, odo: 0 },
            { timestamp: 1600000002, battery_cell_voltage_delta: 0.000001 },
            { timestamp: 1600000003, battery_cell_voltage_min: null, odo: null },
            { timestamp: 1600000004, soc_display: 80 }
        ]);
        try {
            const zip = await JSZip.loadAsync(await util.promisify(fs.readFile)(file));
            const workbook = await zip.file('xl/workbook.xml').async('string');
            assert.ok(workbook.includes('Extended telemetry history'));
            const strings = await zip.file('xl/sharedStrings.xml').async('string');
            ['Cell voltage minimum (V)', 'Cell voltage maximum (V)', 'Cell voltage delta (V)',
                'Battery fan level (raw)', 'Odometer (km)'].forEach(header => assert.ok(strings.includes(header)));
            const sheet = await zip.file('xl/worksheets/sheet3.xml').async('string');
            const numeric = (cell, value) => assert.ok(new RegExp('<c[^>]*r="' + cell + '"[^>]*t="n"[^>]*><v>' + value + '</v></c>').test(sheet), cell + ' should contain numeric ' + value);
            numeric('B2', '3.78'); numeric('C2', '3.8'); numeric('D2', '0.02');
            numeric('E2', '3'); numeric('F2', '123456');
            ['B3', 'C3', 'D3', 'E3', 'F3'].forEach(cell => numeric(cell, '0'));
            numeric('D4', '0.000001');
            ['B4', 'C4', 'E4', 'F4', 'A5'].forEach(cell => assert.ok(!sheet.includes('r="' + cell + '"')));
        } finally {
            await util.promisify(fs.unlink)(file);
        }
    });

    it('provides English and German worksheet and measurement labels', () => {
        ['en', 'de'].forEach(lng => {
            ['EXTENDED_TELEMETRY_HISTORY', 'BATTERY_CELL_VOLTAGE_MIN_V', 'BATTERY_CELL_VOLTAGE_MAX_V',
                'BATTERY_CELL_VOLTAGE_DELTA_V', 'BATTERY_FAN_LEVEL_RAW', 'ODOMETER_KM'].forEach(key => {
                assert.notStrictEqual(translation.translate(key, lng), key);
            });
            assert.ok(translation.translate('BATTERY_CELL_VOLTAGE_DELTA_V', lng).includes('(V)'));
            assert.ok(translation.translate('ODOMETER_KM', lng).includes('(km)'));
        });
    });

    it('includes localized telemetry in the general report path', () => {
        loader.restore();
        const sheets = [];
        function Workbook() {
            this.addWorksheet = name => {
                const sheet = { name, cells: {} };
                sheets.push(sheet);
                return { cell: (row, column) => {
                    const set = type => value => { sheet.cells[row + ',' + column] = { type, value }; };
                    return { date: set('date'), number: set('number'), string: set('string') };
                } };
            };
            this.write = () => {};
        }
        loader = loadModule('./modules/report', {
            excel4node: { Workbook },
            './modules/token': { validateToken: (akey, token, cb) => cb(null, true) },
            './modules/db': { query: (sql, params, cb) => {
                assert.deepStrictEqual(params, ['ABC123']);
                cb(null, sql.includes('SELECT lng') ? [{ lng: 'de' }] : [
                    { timestamp: 1600000000, battery_cell_voltage_delta: '0.020000', battery_fan_speed: 0 }
                ]);
            } }
        });
        const res = createResponse();
        loader.module.downloadReport({ query: { akey: 'ABC123', token: 'secret' } }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { report: 'Excel.xlsx' });
        assert.strictEqual(sheets[2].name, 'Erweiterte Telemetrie');
        assert.strictEqual(sheets[2].cells['1,4'].value, 'Zellspannungsdifferenz (V)');
        assert.deepStrictEqual(sheets[2].cells['2,4'], { type: 'number', value: 0.02 });
        assert.deepStrictEqual(sheets[2].cells['2,5'], { type: 'number', value: 0 });
        assert.strictEqual(sheets[2].cells['2,2'], undefined);
    });
});
