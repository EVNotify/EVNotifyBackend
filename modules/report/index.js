/**
 * @file modules/report/index.js
 * @author GPlay97
 * @description Module for report
 */
const fs = require('fs'),
    excel = require('excel4node'),
    db = require('./../db'),
    tokenModule = require('./../token'),
    translation = require('./../translation'),
    srv_errors = require("./../../srv_errors.json"),
    srv_config = require("./../../srv_config.json");
/**
 * contains the different converters for the excel cells
 */
const converters = {
    "date": v => new Date(v * 1000),
    "number": v => parseFloat(v),
}

/**
 * each entry of this array represents one worksheet configuration.
 * 
 * name is the translation key for the name of the worksheet
 * condition is a list of sql columns. If at least one of these columns is not null in a mysql row, a new excel row is created
 * sql_columns is a list of objects, where each object contains the name and type of a sql column that should be added to the excel sheet in the column with the name contained in excel_name
 */
const worksheets = [
    {
        "name":"SOC_HISTORY",
        "condition": ["soc_display","soc_bms", ],
        "sql_columns": [
            {"name":"timestamp", "type":"date", "excel_name": "DATE_TIME"},
            {"name":"soc_display", "type":"number", "excel_name": "SOC_DISPLAY"},
            {"name":"soc_bms", "type":"number", "excel_name": "SOC_BMS"},
        ],
    },
    {
        "name":"LOCATION_HISTORY",
        "condition": ["latitude","longitude", "gps_speed", ],
        "sql_columns": [
            {"name":"timestamp", "type":"date", "excel_name": "DATE_TIME"},
            {"name":"latitude", "type":"number", "excel_name": "LATITUDE"},
            {"name":"longitude", "type":"number", "excel_name": "LONGITUDE"},
            {"name":"gps_speed", "type":"number", "excel_name": "SPEED"},
        ],
    },
];

/**
 * This object can be used to create a worksheet in a workbook
 * 
 * @param workbook the workbook where the worksheed should be contained in
 * @param lng the translation language for this worksheet
 * @param configuration the configuration for this worksheet
 */
function Worksheet(workbook, lng, configuration) {
    const worksheet = workbook.addWorksheet(translation.translate(configuration.name, lng, true));
    var rowIndex = 2;
    // add header rows
    configuration.sql_columns.forEach((col, idX) => worksheet.cell(1, idX + 1).string(translation.translate(col.excel_name, lng, true)));

    /**
     * adds a new row to this worksheet, if the condition is met
     * 
     * @param {object} row the row that should be added
     */
    this.processRow = function(row) {
        // check if at least one of the conditions is not null
        if (!configuration.condition.reduce(((prev, cur) => prev || row[cur]!=null), false)) return;
        // add row
        configuration.sql_columns.forEach((val, i) => (row[val.name] != null) ? worksheet.cell(rowIndex, i+1)[val.type](converters[val.type](row[val.name])) : false);
        rowIndex += 1;
    }
}
/**
 * Creates report
 * @param {String} akey the akey
 * @param {String} token the token of the account
 * @param {Function} callback callback function
 */
const createReport = (akey, token, callback) => {
    // authenticate
    tokenModule.validateToken(akey, token, (err, valid) => {
        if (!err && valid) {
            // retrieve user preferred language
            db.query('SELECT lng FROM settings WHERE akey=?', [
                akey
            ], (err, settingsRes) => {
                if (!err && Array.isArray(settingsRes) && settingsRes[0] != null) {
                    const lng = settingsRes[0].lng || 'en';

                    // retrieve all data from statistics (soc)
                    db.query('SELECT * FROM statistics WHERE akey=? ORDER BY timestamp ASC', [
                        akey,
                    ], (err, dataRes) => {
                        if (!err && Array.isArray(dataRes)) {
                            let wb = new excel.Workbook(),
                                wss = worksheets.map(e => new Worksheet(wb, lng, e));
                            dataRes.forEach(e => wss.forEach(w => w.processRow(e)));
                            // TODO dynamic filename (tmp file which need to be unlinked and streamed to user..)
                            wb.write('Excel.xlsx');
                            callback(null, 'Excel.xlsx');
                        } else callback(err);
                    });
                } else callback(err);
            });
        } else callback(err);
    });
};

module.exports = {
    /**
     * downloadReport request handler
     * @param {Object} req the server request
     * @param {Object} res the server request
     */
    downloadReport: (req, res) => {
        // validate params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // create the report
        createReport(req.query.akey, req.query.token, (err, report) => {
            if (!err && report) {
                res.json({
                    report
                });
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};