/**
 * @file modules/helper/index.js
 * @author GPlay97
 * @description Helper module containing serveral functions for re-use
 */

/**
 * Calculates range for given car, consumption and its state of charge
 * @param {String} car the car to use for calculation
 * @param {Number} soc the current state of charge car has
 * @param {Number} consumption the current consumption to use for calculation
 * @returns {Number} the calculated left range for given state of charge in kilometers
 */
const calculateRange = (car, soc, consumption) => {
    const capacities = {
        AMPERA_E: 60,
        IONIQ_BEV: 28,
        IONIQ_HEV: 1.6,
        IONIQ_PHEV: 8.9,
        KONA_EV: 64,
        SOUL_EV: 28
    };
    const total = parseInt((capacities[car] / consumption) * 100) || 0;

    return parseInt(total * ((soc === 100) ? 1 : '0.' + ((soc < 10) ? ('0' + parseInt(soc)) : parseInt(soc)))) || 0;
};

module.exports = {
    calculateRange
};