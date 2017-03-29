'use strict';

/**
 * Converts event data to InfluxDB line protocol
 * https://docs.influxdata.com/influxdb/v0.12/write_protocols/line/
 */

// Load modules

const Os = require('os');
const Qs = require('querystring');
const Url = require('url');
const Hoek = require('hoek');
const Stringify = require('fast-safe-stringify');

// Declare internals

const internals = {
    host: Os.hostname()
};

/* eslint-disable no-confusing-arrow */
internals.Int = (value) => isNaN(Number(value)) ? value : String(value) + 'i';

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

internals.formatError = (error) => {

    if (!error instanceof Error) {
        return internals.String(error);
    }

    const result = {
        'error.name'    : internals.String(error.name),
        'error.message' : internals.String(error.message),
        'error.stack'   : internals.String(error.stack)
    };

    if (error.isBoom) {
        result['error.statusCode'] = internals.Int(error.output.statusCode);

        Object.keys(error.data).forEach((key) => {

            result[`error.data.${key}`] = internals.String(error.data[key]);
        });
    }

    return result;
};

internals.values = {
    error: (event) => Object.assign(
        {},
        internals.formatError(event.error),
        {
            id     : internals.String(event.id),
            url    : internals.String(event.url && Url.format(event.url)),
            method : internals.String(event.method && event.method.toUpperCase()),
            tags   : internals.String(event.tags)
        }
    ),
    log: (event) => {

        if (event.data instanceof Error) {

            return Object.assign(
                {},
                internals.formatError(event.data),
                { tags: internals.String(event.tags) }
            );
        }

        return {
            data : internals.String(event.data),
            tags : internals.String(event.tags)
        };
    },
    ops: (event) => {

        const load = Hoek.reach(event, 'os.load', { default: new Array(3) });

        return {
            'os.cpu1m'       : load[0],
            'os.cpu5m'       : load[1],
            'os.cpu15m'      : load[2],
            'os.freemem'     : internals.Int(Hoek.reach(event, 'os.mem.free')),
            'os.totalmem'    : internals.Int(Hoek.reach(event, 'os.mem.total')),
            'os.uptime'      : internals.Int(Hoek.reach(event, 'os.uptime')),
            'proc.delay'     : Hoek.reach(event, 'proc.delay'),
            'proc.heapTotal' : internals.Int(Hoek.reach(event, 'proc.mem.heapTotal')),
            'proc.heapUsed'  : internals.Int(Hoek.reach(event, 'proc.mem.heapUsed')),
            'proc.rss'       : internals.Int(Hoek.reach(event, 'proc.mem.rss')),
            'proc.uptime'    : Hoek.reach(event, 'proc.uptime')
        };
    },
    ops_requests: (event) => {
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

            return Object.assign({
                'port': port,
                'requestsTotal': requests[port].total,
                'requestsDisconnects': requests[port].disconnects
            }, statusCodesValues);
        });
    },
    ops_concurrents: (event) => {
        const concurrents = Hoek.reach(event, 'load.concurrents');
        if (Object.keys(concurrents).length === 0) {
            return null;
        }

        return Object.keys(concurrents).map((port) => {
            return {
                'port': port,
                'concurrents': concurrents[port]
            };
        });
    },
    ops_responseTimes: (event) => {
        const responseTimes = Hoek.reach(event, 'load.responseTimes');
        if (Object.keys(responseTimes).length === 0) {
            return null;
        }
        return Object.keys(responseTimes).map((port) => {
            const stats = {};
            Object.keys(responseTimes[port]).map((aggregator) => {
                stats[aggregator] = responseTimes[port][aggregator];
                return null;
            });
            return Object.assign({
                'port': port
            }, stats);
        });
    },
    ops_sockets: (event) => {
        const sockets = Hoek.reach(event, 'load.sockets');
        if (Object.keys(sockets).length === 0) {
            return null;
        }
        const socketsValues = {};
        Object.keys(sockets).map((protocol) => {
            const key = protocol + 'Total';
            socketsValues[key] = sockets[protocol].total;
            return null;
        });
        return [socketsValues];
    },
    request: (event) => {

        if (event.data instanceof Error) {

            return Object.assign(
                {},
                internals.formatError(event.data),
                {
                    id     : internals.String(event.id),
                    method : internals.String(event.method && event.method.toUpperCase()),
                    path   : internals.String(event.path),
                    tags   : internals.String(event.tags)
                }
            );
        }

        return {
            data   : internals.String(event.data),
            id     : internals.String(event.id),
            method : internals.String(event.method && event.method.toUpperCase()),
            path   : internals.String(event.path),
            tags   : internals.String(event.tags)
        };
    },
    response: (event) => {

        return {
            httpVersion   : internals.String(event.httpVersion),
            id            : internals.String(event.id),
            instance      : internals.String(event.instance),
            labels        : internals.String(event.labels),
            method        : internals.String(event.method && event.method.toUpperCase()),
            path          : internals.String(event.path),
            query         : internals.String(Qs.stringify(event.query)),
            referer       : internals.String(Hoek.reach(event, 'source.referer')),
            remoteAddress : internals.String(Hoek.reach(event, 'source.remoteAddress')),
            responseTime  : internals.Int(event.responseTime),
            statusCode    : internals.Int(event.statusCode),
            userAgent     : internals.String(Hoek.reach(event, 'source.userAgent'))
        };
    }
};

internals.serialize = (obj) => Object.keys(obj)
    .map((key) => `${key}=${obj[key]}`)
    .join(',');

const formatHelper = function (eventName, timestamp, tags, eventValues, config) {
    if (eventValues !== null) {
        const finalEventValues = eventValues.map((value) => {
            if (config.metadata) {
                Object.keys(config.metadata).forEach( (key) => {
                    value[key] = internals.String(config.metadata[key]);
                });
            }
            const fields = internals.serialize(value);
            // Timestamp in InfluxDB is in nanoseconds
            return `${eventName},${tags} ${fields} ${timestamp}000000`;
        });
        return finalEventValues;
    }
    return [];
};

module.exports.format = (event, config) => {
    const eventName = event.event;
    const timestamp = event.timestamp;

    const getEventValues = internals.values[eventName];
    if (!getEventValues) {
        return;
    }

    const tags = internals.serialize(internals.tags(event));
    const eventValues = getEventValues(event);
    if (config.metadata) {
        Object.keys(config.metadata).forEach( (key) => {
            eventValues[key] = internals.String(config.metadata[key]);
        });
    }

    const values = internals.serialize(eventValues);

    let loadValues = [];
    if (eventName === 'ops') {
        const requests = internals.values.ops_requests(event);
        loadValues = loadValues.concat(formatHelper('ops_requests',timestamp,tags,requests,config));

        const concurrents = internals.values.ops_concurrents(event);
        loadValues = loadValues.concat(formatHelper('ops_concurrents',timestamp,tags,concurrents,config));

        const responseTimes = internals.values.ops_responseTimes(event);
        loadValues = loadValues.concat(formatHelper('ops_responseTimes',timestamp,tags,responseTimes,config));

        const sockets = internals.values.ops_sockets(event);
        loadValues = loadValues.concat(formatHelper('ops_sockets',timestamp,tags,sockets,config));
    }
    // Timestamp in InfluxDB is in nanoseconds
    if (loadValues.length === 0) {
        return `${eventName},${tags} ${values} ${timestamp}000000`;
    }
    return [`${eventName},${tags} ${values} ${timestamp}000000`].concat(loadValues).join('\n');
};
