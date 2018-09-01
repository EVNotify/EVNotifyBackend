/**
 * @file modules/report/index.js
 * @author GPlay97
 * @description Module for report
 */
const fs = require('fs'),
    excel = require('excel4node'),
    db = require('./../db'),
    tokenModule = require('./../token'),
    translation = require('./../translation');

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
                    db.query('SELECT type, value, timestamp FROM statistics WHERE akey=? AND (type=? OR type=? OR type=? OR type=? OR type=?) ORDER BY timestamp ASC', [
                        akey, 'soc_display', 'soc_bms', 'latitude', 'longitude', 'gps_speed'
                    ], (err, dataRes) => {
                        if (!err && Array.isArray(dataRes)) {
                            let wb = new excel.Workbook(),
                                ws = wb.addWorksheet(translation.translate('SOC_HISTORY', lng, true)),
                                ws2 = wb.addWorksheet(translation.translate('LOCATION_HISTORY', lng, true)),
                                curRow = 2,
                                socDisplay = dataRes.filter(data => data.type === 'soc_display'),
                                socBMS = dataRes.filter(data => data.type === 'soc_bms'),
                                socData = [...new Set(socDisplay.concat(socBMS).map(data => data.timestamp))], // unique timestamps
                                latitude = dataRes.filter(data => data.type === 'latitude'),
                                longitude = dataRes.filter(data => data.type === 'longitude'),
                                gpsSpeed = dataRes.filter(data => data.type === 'gps_speed'),
                                locationData = [...new Set(latitude.concat(longitude).concat(gpsSpeed).map(data => data.timestamp))];

                            // build the header for the soc history
                            ['SOC_DISPLAY', 'SOC_BMS', 'DATE_TIME'].forEach((field, idX) => ws.cell(1, idX + 1).string(translation.translate(field, lng, true)));
                            // build the rows for the soc history
                            socData.forEach(timestamp => {
                                let soc_display = (socBMS.filter(obj => obj.timestamp === timestamp)[0] || {}).value,
                                    soc_bms = (socDisplay.filter(obj => obj.timestamp === timestamp)[0] || {}).value;

                                // SOC_DISPLAY
                                if (soc_display != null) ws.cell(curRow, 1).number(parseFloat(soc_bms)|| 0);
                                else ws.cell(curRow, 1).string('?');
                                // SOC_BMS
                                if (soc_bms != null) ws.cell(curRow, 2).number(parseFloat(soc_display)|| 0);
                                else ws.cell(curRow, 2).string('?');
                                // DATE_TIME
                                ws.cell(curRow, 3).date(new Date(timestamp * 1000));
                                curRow++; // increase the current row
                            });
                            curRow = 2; // reset the current row for next worksheet
                            // build the header for the location history
                            ['LATITUDE', 'LONGITUDE', 'SPEED', 'DATE_TIME'].forEach((field, idX) => ws2.cell(1, idX + 1).string(translation.translate(field, lng, true)));
                            locationData.forEach(timestamp => {
                                let lat = (latitude.filter(obj => obj.timestamp === timestamp)[0] || {}).value,
                                    long = (longitude.filter(obj => obj.timestamp === timestamp)[0] || {}).value,
                                    speed = (gpsSpeed.filter(obj => obj.timestamp === timestamp)[0] || {}).value;

                                // LATITUDE
                                if (lat != null) ws2.cell(curRow, 1).number(parseFloat(lat)|| 0);
                                else ws2.cell(curRow, 1).string('?');
                                // LONGITUDE
                                if (long != null) ws2.cell(curRow, 2).number(parseFloat(long)|| 0);
                                else ws2.cell(curRow, 2).string('?');
                                // SPEED
                                if (speed != null) ws2.cell(curRow, 3).number(parseFloat(speed)|| 0);
                                else ws2.cell(curRow, 3).string('?');
                                // DATE_TIME
                                ws2.cell(curRow, 4).date(new Date(timestamp * 1000)); // DATE_TIME
                                curRow++; // increase the current row
                            });
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