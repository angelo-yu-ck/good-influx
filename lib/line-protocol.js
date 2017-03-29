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
const OpsFormatter = require('./ops-formatter');

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

internals.tags = (rawEvent, formattedEvent) => {

    const tags = {
        host : rawEvent.host || internals.host,
        pid  : rawEvent.pid
    };
    if (formattedEvent.port) {
        tags.port = formattedEvent.port;
    }
    return tags;
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
    error: (event) => [Object.assign(
        {},
        internals.formatError(event.error),
        {
            id     : internals.String(event.id),
            url    : internals.String(event.url && Url.format(event.url)),
            method : internals.String(event.method && event.method.toUpperCase()),
            tags   : internals.String(event.tags)
        }
    )],
    log: (event) => {

        if (event.data instanceof Error) {

            return [Object.assign(
                {},
                internals.formatError(event.data),
                { tags: internals.String(event.tags) }
            )];
        }

        return [{
            data : internals.String(event.data),
            tags : internals.String(event.tags)
        }];
    },
    ops: OpsFormatter,
    request: (event) => {

        if (event.data instanceof Error) {

            return [Object.assign(
                {},
                internals.formatError(event.data),
                {
                    id     : internals.String(event.id),
                    method : internals.String(event.method && event.method.toUpperCase()),
                    path   : internals.String(event.path),
                    tags   : internals.String(event.tags)
                }
            )];
        }

        return [{
            data   : internals.String(event.data),
            id     : internals.String(event.id),
            method : internals.String(event.method && event.method.toUpperCase()),
            path   : internals.String(event.path),
            tags   : internals.String(event.tags)
        }];
    },
    response: (event) => {

        return [{
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
        }];
    }
};

internals.serialize = (obj) => Object.keys(obj)
    .map((key) => `${key}=${obj[key]}`)
    .join(',');

internals.removeTempProperties = (event) => {
    delete event['port'];
    delete event['eventName'];
    return event;
}

module.exports.format = (event, config) => {
    const defaultEventName = event.event;
    const timestamp = event.timestamp;

    const getEventValues = internals.values[defaultEventName];
    if (!getEventValues) {
        return;
    }

    const eventValuesArray = getEventValues(event);

    const formattedEventsArray = eventValuesArray.map((formattedEvent) => {
        if (config.metadata) {
            Object.keys(config.metadata).forEach( (key) => {
                formattedEvent[key] = internals.String(config.metadata[key]);
            });
        }
        const tags = internals.serialize(internals.tags(event, formattedEvent));
        const eventName = formattedEvent.eventName || defaultEventName;
        const values = internals.serialize(internals.removeTempProperties(formattedEvent));
        // Timestamp in InfluxDB is in nanoseconds
        return `${eventName},${tags} ${values} ${timestamp}000000`;
    });

    return formattedEventsArray.join('\n');
};
