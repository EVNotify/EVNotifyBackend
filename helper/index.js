/**
 * Helper file - re-usable functions are declared here
 */
module.exports = {
    /**
     * Function which calculates estimated range for given state of charge based on manual consumption value
     * @param  {Number} soc         the state of charge to calculate the range for
     * @param  {Number} consumption the consumption
     * @return {String}             formatted string for estimated range
     */
    calculateEstimatedRange: function(soc, consumption) {
        if(typeof soc !== 'number') return '?';
        // TODO calulcation based on car
        if(soc < 10) soc = '0' + soc.toString();    // correct low values
        return parseInt((28 / (consumption || 13)) * 100 * ((soc === 100)? 1 : '0.' + soc)) + 'km / ' + // current
            parseInt((28 / (consumption || 13)) * 100) + 'km';  // total
        // TODO use range retrieved directly from car..
    },
    /**
     * Converts unix timestamp into YYYY-MM-DD hh:ii:ss string
     * @param  {Number} timestamp   the unix time (seconds since 01-01-1970) to convert
     * @return {String}             the formatted string (if invalid date, '?' will be returned)
     */
    unixToTimeString: function(timestamp) {
        var date = new Date(timestamp * 1000);

        return ((date.toString() !== 'Invalid Date')?
                date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' +
                date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() : '?');
    }
};
