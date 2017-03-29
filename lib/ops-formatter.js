'use strict';

const Hoek = require('hoek');

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

// const internals = {
//     Int:
// };

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
    const loadRequests = Hoek.reach(event, 'load.requests', { default: {} });
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
    const concurrentRequests = Hoek.reach(event, 'load.concurrents', { default: {} });
    Object.keys(concurrentRequests).forEach((concurrentPort) => {
        opsInfoArray.push({
            eventName:  'ops_concurrents',
            port:       concurrentPort,
            concurrents: internals.Int(concurrentRequests[concurrentPort])
        });
    });



    return opsInfoArray;
};
