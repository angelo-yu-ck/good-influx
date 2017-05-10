'use strict';
// Load modules

const Os = require('os');
const Hoek = require('hoek');
const Stringify = require('fast-safe-stringify');

const internals = {
    host: Os.hostname()
};

/* eslint-disable no-confusing-arrow */
//internals.Int = (value) => isNaN(Number(value)) ? value : String(value) + 'i';
internals.Int = (value) => {
    if (isNaN(Number(value))) {
        return value;
    }
    return `${String(value)}i`;
};

internals.String = (value) => {
    let string;

    if (Object.prototype.toString.call(value) === '[object Object]' &&
        !Array.isArray(value)) {
        string = Stringify(value).replace(/"/g, '\\"');
    }
    else {
        string = String(value);
    }

    return `"${string}"`;
};

internals.tags = (event) => {
    return {
        host : event.host || internals.host,
        pid  : event.pid
    };
};

internals.serialize = (obj) => {
    return Object.keys(obj)
        .map((key) => `${key}=${obj[key]}`)
        .join(',');
};

const opsRequests = (event) => {
    const requests = Hoek.reach(event, 'load.requests');
    if (Object.keys(requests).length === 0) {
        return null;
    }
    return Object.keys(requests).map((port) => {
        const statusCodesValues = {};
        Object.keys(requests[port].statusCodes).map((code) => {
            const key = 'requests' + code;
            statusCodesValues[key] = requests[port].statusCodes[code];
            return null;
        });
        const tags = {
            'port': port
        };
        const fields = Object.assign({
            'requestsTotal': requests[port].total,
            'requestsDisconnects': requests[port].disconnects
        },statusCodesValues);

        return {
            'tags': tags,
            'fields': fields
        };
    });
};

const opsConcurrents = (event) => {
    const concurrents = Hoek.reach(event, 'load.concurrents');
    if (Object.keys(concurrents).length === 0) {
        return null;
    }

    return Object.keys(concurrents).map((port) => {
        return {
            'tags' : {
                'port': port
            },
            'fields' : {
                'concurrents': concurrents[port]
            }
        };
    });
};

const opsResponseTimes = (event) => {
    const responseTimes = Hoek.reach(event, 'load.responseTimes');
    if (Object.keys(responseTimes).length === 0) {
        return null;
    }
    return Object.keys(responseTimes).map((port) => {
        const stats = {};
        Object.keys(responseTimes[port]).forEach((aggregator) => {
            stats[aggregator] = isNaN(responseTimes[port][aggregator]) || (responseTimes[port][aggregator] === null) ? 0 : responseTimes[port][aggregator];
        });
        const tags = {
            'port': port
        };
        return {
            'tags': tags,
            'fields': stats
        };
    });
};

const opsSockets = (event) => {
    const sockets = Hoek.reach(event, 'load.sockets');
    if (Object.keys(sockets).length === 0) {
        return null;
    }
    const socketsValues = {
        'tags': {},
        'fields': {}
    };
    Object.keys(sockets).forEach((protocol) => {
        const key = protocol + 'Total';
        socketsValues.fields[key] = sockets[protocol].total;
    });
    return [socketsValues];
};

const opsFormat = function (event, config) {
    const timestamp = event.timestamp;
    const tags = internals.serialize(internals.tags(event));

    let loadValues = [];
    const requests = opsRequests(event);
    loadValues = loadValues.concat(opsFormatHelper('ops_requests',timestamp,tags,requests,config));

    const concurrents = opsConcurrents(event);
    loadValues = loadValues.concat(opsFormatHelper('ops_concurrents',timestamp,tags,concurrents,config));

    const responseTimes = opsResponseTimes(event);
    loadValues = loadValues.concat(opsFormatHelper('ops_responseTimes',timestamp,tags,responseTimes,config));

    const sockets = opsSockets(event);
    loadValues = loadValues.concat(opsFormatHelper('ops_sockets',timestamp,tags,sockets,config));
    return loadValues;
};

const opsFormatHelper = function (eventName, timestamp, tags, eventValues, config) {
    if (eventValues !== null) {
        const finalEventValues = eventValues.map((value) => {
            if (config.metadata) {
                Object.keys(config.metadata).forEach( (key) => {
                    value.fields[key] = internals.String(config.metadata[key]);
                });
            }

            let finalTags = '';
            const fields = internals.serialize(value.fields);
            if (value.tags && Object.keys(value.tags).length > 0) {
                const eventTags = internals.serialize(value.tags);
                finalTags = [tags,eventTags].join(',');
            }
            else {
                finalTags = tags;
            }
            // Timestamp in InfluxDB is in nanoseconds
            return `${eventName},${finalTags} ${fields} ${timestamp}000000`;
        });
        return finalEventValues;
    }
    return [];
};

module.exports.format = (event, config) => {
    return opsFormat(event,config);
};
