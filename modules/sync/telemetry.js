// Only these known columns may participate in dynamic telemetry queries.
const fields = {
    soh: 'soh',
    charging: 'charging',
    rapidChargePort: 'rapid_charge_port',
    normalChargePort: 'normal_charge_port',
    slowChargePort: 'slow_charge_port',
    auxBatteryVoltage: 'aux_battery_voltage',
    dcBatteryVoltage: 'dc_battery_voltage',
    dcBatteryCurrent: 'dc_battery_current',
    dcBatteryPower: 'dc_battery_power',
    cumulativeEnergyCharged: 'cumulative_energy_charged',
    cumulativeEnergyDischarged: 'cumulative_energy_discharged',
    batteryMinTemperature: 'battery_min_temperature',
    batteryMaxTemperature: 'battery_max_temperature',
    batteryInletTemperature: 'battery_inlet_temperature',
    externalTemperature: 'external_temperature',
    odo: 'odo',
    batteryCellVoltageMin: 'battery_cell_voltage_min',
    batteryCellVoltageMax: 'battery_cell_voltage_max',
    batteryCellVoltageDelta: 'battery_cell_voltage_delta',
    batteryFanSpeed: 'battery_fan_speed'
};

const voltages = ['batteryCellVoltageMin', 'batteryCellVoltageMax', 'batteryCellVoltageDelta'];
const validatedFields = voltages.concat(['batteryFanSpeed', 'odo']);
const present = (body, field) => Object.prototype.hasOwnProperty.call(body, field);

const valid = body => validatedFields.every(field => {
    if (!present(body, field) || body[field] === null) return true;
    const value = body[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
    if (field === 'odo') return Number.isInteger(value) && value <= 2147483647;
    if (field === 'batteryFanSpeed') return Number.isFinite(Math.fround(value));
    return value <= 999999.999999;
});

const supplied = body => Object.keys(fields).filter(field => present(body, field));
const storedValue = (body, field) => {
    const value = body[field];
    if (value === null) return null;
    if (voltages.indexOf(field) !== -1) return Number(value.toFixed(6));
    // Normalize before SQL: a double just above FLOAT_MAX may still round to a
    // finite float, but MySQL rejects the unrounded double as out of range.
    if (field === 'batteryFanSpeed') return Math.fround(value);
    return value;
};

const serialize = row => {
    if (!row) return row;
    validatedFields.forEach(field => {
        const column = fields[field];
        if (row[column] != null) row[column] = Number(row[column]);
    });
    return row;
};

module.exports = { fields, valid, supplied, storedValue, serialize };
