/**
 * @file modules/webhook/index.js
 * @author GPlay97
 * @description Webhook Module to be able to inform user about specific events
 */
const request = require('request');
const db = require('./../db');
const dns = require('dns');
const net = require('net');
const timers = require('timers');
const ipaddr = require('ipaddr.js');
// Match the parser used by request so validation and delivery agree on the host.
const parseUrl = require('url').parse;
const URL = require('url').URL;

const validateUrl = uri => {
    try {
        if (typeof uri !== 'string' || !/^https:\/\//i.test(uri) || /\s/.test(uri)) return null;
        // Check syntax and port bounds, then use request's parser for host policy.
        const url = parseUrl(new URL(uri).href);
        if (url.protocol !== 'https:' || !url.hostname || url.hostname === 'unix') return null;
        return url;
    } catch (err) {
        return null;
    }
};

const isPublicAddress = address => {
    try {
        if (!net.isIP(address) || address.includes('%')) return false;
        const ip = ipaddr.process(address);
        if (ip.range() !== 'unicast') return false;
        if (ip.kind() === 'ipv4') {
            return !ip.match(ipaddr.parseCIDR('198.18.0.0/15'));
        }
        // Only global IPv6 unicast, excluding special-purpose and documentation ranges.
        return ip.match(ipaddr.parseCIDR('2000::/3')) &&
            !ip.match(ipaddr.parseCIDR('2001::/23')) &&
            !ip.match(ipaddr.parseCIDR('3fff::/20'));
    } catch (err) {
        return false;
    }
};

const resolveDestination = (hostname, callback) => {
    if (net.isIP(hostname)) {
        return callback(isPublicAddress(hostname) ? null : new Error('Blocked webhook destination'),
            { address: hostname, family: net.isIP(hostname) });
    }

    let finished = false;
    const finish = (err, address) => {
        if (finished) return;
        finished = true;
        timers.clearTimeout(timeout);
        callback(err, address);
    };
    const timeout = timers.setTimeout(() => finish(new Error('Webhook DNS lookup timed out')), 10000);
    try {
        dns.lookup(hostname, { all: true }, (err, addresses) => {
            if (err || !Array.isArray(addresses) || !addresses.length) {
                return finish(new Error('Webhook DNS lookup failed'));
            }
            if (!addresses.every(entry => entry && isPublicAddress(entry.address) &&
                net.isIP(entry.address) === entry.family)) {
                return finish(new Error('Blocked webhook destination'));
            }
            finish(null, addresses[0]);
        });
    } catch (err) {
        finish(new Error('Webhook DNS lookup failed'));
    }
};

const canSendToken = uri => {
    try {
        const url = parseUrl(uri);
        return url.protocol === 'https:' && typeof url.hostname === 'string' &&
            ['evnotify.de', 'evnotify.com'].some(domain =>
            url.hostname === domain || url.hostname.endsWith('.' + domain));
    } catch (err) {
        return false;
    }
};

module.exports = {
    /**
     * Sends Event to webhook url if specified for given type and response
     */
    emit: (akey, token, type, response) => {
        db.query('SELECT webhook FROM settings WHERE akey=?', [
            akey
        ], (err, dbRes) => {
            if (!err && dbRes && dbRes[0] && dbRes[0].webhook) {
                const url = validateUrl(dbRes[0].webhook);
                if (!url) {
                    console.error(new Error('Invalid webhook URL; delivery skipped'));
                    return;
                }
                const sendToken = canSendToken(url.href);
                const body = { akey, type, response };

                // Extended telemetry includes the incoming credentials. Never forward
                // its token implicitly or mutate the original request body.
                if (response && typeof response === 'object') {
                    body.response = Array.isArray(response) ? response.slice() : Object.assign({}, response);
                    delete body.response.token;
                }
                if (sendToken) body.token = token;

                resolveDestination(url.hostname, (err, destination) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    // Reuse exactly the checked address; never resolve again at connection time.
                    const lookup = (hostname, options, callback) => {
                        if (typeof options === 'function') {
                            callback = options;
                            options = {};
                        }
                        if (hostname !== url.hostname) return callback(new Error('Unexpected webhook hostname'));
                        if (options && options.all) return callback(null, [destination]);
                        callback(null, destination.address, destination.family);
                    };
                    try {
                        request({
                            uri: url.href,
                            method: 'POST',
                            json: true,
                            timeout: 10000,
                            followRedirect: false,
                            followAllRedirects: false,
                            proxy: null,
                            pool: false,
                            lookup,
                            family: destination.family,
                            body
                        }, (err, response) => {
                            if (err) {
                                console.error(new Error('Webhook delivery failed'));
                            } else if (response && (response.statusCode < 200 || response.statusCode >= 300)) {
                                console.error(new Error('Webhook delivery failed: HTTP ' + response.statusCode));
                            }
                        });
                    } catch (err) {
                        console.error(new Error('Webhook delivery failed'));
                    }
                });
            }
        });
    }
};
