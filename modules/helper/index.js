/**
 * @file modules/helper/index.js
 * @author GPlay97
 * @description Helper module containing serveral functions for re-use
 */

/**
 * Retrieves capacities for all available cars
 * @returns {Object} object containing all cars with their corresponding capacities
 */
const getCapacities = () => ({
    AMPERA_E: 60,
    IONIQ_BEV: 28,
    IONIQ_HEV: 1.6,
    IONIQ_PHEV: 8.9,
    KONA_EV: 64,
    SOUL_EV: 28
});

/**
 * Retrieves default charging speeds for different charging ports of all available cars
 * @returns {Object} object containing all available speeds of all cars
 */
const getChargingSpeeds = () => ({
    AMPERA_E: {
        SLOW_SPEED: 2.3,
        NORMAL_SPEED: 4.6,
        FAST_SPEED: 40
    },
    IONIQ_BEV: {
        SLOW_SPEED: 2.3,
        NORMAL_SPEED: 4.6,
        FAST_SPEED: 50
    },
    IONIQ_HEV: {
        SLOW_SPEED: 0,
        NORMAL_SPEED: 0,
        FAST_SPEED: 0
    },
    IONIQ_PHEV: {
        SLOW_SPEED: 2.3,
        NORMAL_SPEED: 4.6,
        FAST_SPEED: 0
    },
    KONA_EV: {
        SLOW_SPEED: 2.3,
        NORMAL_SPEED: 4.6,
        FAST_SPEED: 50
    },
    SOUL_EV: {
        SLOW_SPEED: 2.3,
        NORMAL_SPEED: 4.6,
        FAST_SPEED: 50
    }
});

/**
 * Calculates range for given car, consumption and its state of charge
 * @param {String} car the car to use for calculation
 * @param {Number} soc the current state of charge car has
 * @param {Number} consumption the current consumption to use for calculation
 * @returns {Number} the calculated left range for given state of charge in kilometers
 */
const calculateRange = (car, soc, consumption) => {
    const capacities = getCapacities();
    const total = parseInt((capacities[car] / consumption) * 100) || 0;

    return parseInt(total * ((soc === 100) ? 1 : '0.' + ((soc < 10) ? ('0' + parseInt(soc)) : parseInt(soc)))) || 0;
};

/**
 * Calculates estimated time left for full charge based on current state of charge and car (and optional port and speed)
 * @param {String} car the car to use for calculation
 * @param {Number} soc the current state of charge the car has
 * @param {Boolean} charging whether or not car is currently charging
 * @param {String} port on which port car is charging (slow_charge_port|normal_charge_port|rapid_charge_port)
 * @param {Number} speed optional charging speed - if not given, default charging speed of car will be used (for given port)
 * @returns {Object} object containing estimated decimal times for different charge ports or specific port if charging and port given
 */
const calculateTime = (car, soc, charging, port, speed) => {
    const capacities = getCapacities();
    const speeds = getChargingSpeeds();

    const amountToCharge = capacities[car] - parseFloat(capacities[car] * ((soc === 100) ? 1 : '0.' + ((soc < 10) ? ('0' + parseInt(soc)) : parseInt(soc)))).toFixed(2) || 0;
    const realChargingSpeed = ((charging && speed) ? (speed * -1) : false);

    return {
        estimatedSlowTime: ((!port || port === 'slow_charge_port') ? parseFloat((amountToCharge / (realChargingSpeed || speeds[car].SLOW_SPEED)).toFixed(2)) : null),
        estimatedNormalTime: ((!port || port === 'normal_charge_port') ? parseFloat((amountToCharge / (realChargingSpeed || speeds[car].NORMAL_SPEED)).toFixed(2)) : null),
        estimatedFastTime: ((!port || port === 'rapid_charge_port') ? parseFloat((amountToCharge / (realChargingSpeed || speeds[car].FAST_SPEED)).toFixed(2)) : null)
    };
};

module.exports = {
    calculateRange,
    calculateTime
};