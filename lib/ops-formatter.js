'use strict';

const Hoek = require('hoek');

// TODO: This results in some bizarre numbering.
// Check in with the author of the module, ask why he formats this way.
const internals = {
    /* eslint-disable no-confusing-arrow */
    Int: (value) => isNaN(Number(value)) ? value : String(value) + 'i'
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

const hoekObjectDefault = { default: {} };

module.exports = (event) => {

    const cpuLoad = Hoek.reach(event, 'os.load', { default: new Array(3) });

    const opsInfoArray = [{
        'eventName'      : 'ops',
        'os.cpu1m'       : cpuLoad[0],
        'os.cpu5m'       : cpuLoad[1],
        'os.cpu15m'      : cpuLoad[2],
        'os.freemem'     : internals.Int(Hoek.reach(event, 'os.mem.free')),
        'os.totalmem'    : internals.Int(Hoek.reach(event, 'os.mem.total')),
        'os.uptime'      : internals.Int(Hoek.reach(event, 'os.uptime')),
        'proc.delay'     : Hoek.reach(event, 'proc.delay'),
        'proc.heapTotal' : internals.Int(Hoek.reach(event, 'proc.mem.heapTotal')),
        'proc.heapUsed'  : internals.Int(Hoek.reach(event, 'proc.mem.heapUsed')),
        'proc.rss'       : internals.Int(Hoek.reach(event, 'proc.mem.rss')),
        'proc.uptime'    : Hoek.reach(event, 'proc.uptime')
    }];

    // Construct one ops_requests event for each port
    const loadRequests = Hoek.reach(event, 'load.requests', hoekObjectDefault);
    Object.keys(loadRequests).forEach((loadPort) => {
        const request = loadRequests[loadPort];
        const opsRequestsEvent = {
            eventName: 'ops_requests',
            port:      loadPort,
            requestsTotal: Hoek.reach(request, 'total', { default: 0 }),
            requestsDisconnects: Hoek.reach(request, 'disconnects', { default: 0 })
        };

        const statusCodesObject = Hoek.reach(request, 'statusCodes');
        if (statusCodesObject) {
            Object.keys(statusCodesObject).forEach((statusCode) => {
                opsRequestsEvent[`requests${statusCode}`] = statusCodesObject[statusCode];
            });
        }
        opsInfoArray.push(opsRequestsEvent);
    });

    // Construct one ops_concurrents event for each port
    const concurrentRequests = Hoek.reach(event, 'load.concurrents', hoekObjectDefault);
    Object.keys(concurrentRequests).forEach((concurrentPort) => {
        opsInfoArray.push({
            eventName:  'ops_concurrents',
            port:       concurrentPort,
            concurrents: internals.Int(concurrentRequests[concurrentPort])
        });
    });

    const responseTimes = Hoek.reach(event, 'load.responseTimes', hoekObjectDefault);
    Object.keys(responseTimes).forEach((responsePort) => {
        opsInfoArray.push({
            eventName:      'ops_responseTimes',
            port:           responsePort,
            avg:            Hoek.reach(responseTimes[responsePort], 'avg'),
            max:            Hoek.reach(responseTimes[responsePort], 'max')
        });
    });

    const opsSockets = Hoek.reach(event, 'load.sockets', hoekObjectDefault);
    const socketsEvent = {
        eventName:      'ops_sockets'
    };

    const httpTotal = Hoek.reach(opsSockets, 'http.total', { default: null });
    if (httpTotal) {
        socketsEvent.httpTotal = httpTotal;
    }
    const httpsTotal = Hoek.reach(opsSockets, 'https.total', { default: null });
    if (httpsTotal) {
        socketsEvent.httpsTotal = httpsTotal;
    }
    opsInfoArray.push(socketsEvent);

    return opsInfoArray;
};
