'use strict'

const lineProtocol = require('../lib/line-protocol')

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();

const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const testHost = 'myservice.awesome.com'

function getExpectedMessage(ports, metadata) {
    const plusMetadata = metadata || '';
    /* eslint max-len: ["error", 440, 4] */
    const expectedBaseMessage = `ops,host=${testHost},pid=9876 os.cpu1m=3.05078125,os.cpu5m=2.11279296875,os.cpu15m=1.625,os.freemem=147881984i,os.totalmem=6089818112i,os.uptime=23489i,proc.delay=32.29,proc.heapTotal=47271936i,proc.heapUsed=26825384i,proc.rss=64290816i,proc.uptime=22.878${plusMetadata} 1485996802647000000`;
    const eventHost = 'host=myservice.awesome.com,pid=128'
    const loadOpsEvents = ports.map((port) => {
        return [
            `ops_requests,${eventHost} port=${port},requestsTotal=1,requestsDisconnects=1,requests200=61`,
            `ops_concurrents,${eventHost} port=${port},concurrents=23`,
            `ops_responseTimes,${eventHost} port=${port},avg=990,max=1234`,
            `ops_sockets,${eventHost} port=${port},httpTotal=19,httpsTotal=49`
        ].join('\n');
    });
    return expectedBaseMessage + '\n' + loadOpsEvents.join('\n');
}

const testEventBase = JSON.stringify({
    event: 'ops',
    timestamp: 1485996802647,
    host: testHost,
    pid: 9876,
    os: {
        load: [ 3.05078125, 2.11279296875, 1.625 ],
        mem: { total: 6089818112, free: 147881984 },
        uptime: 23489
    },
    proc: {
        uptime: 22.878,
        mem: { rss: 64290816, heapTotal: 47271936, heapUsed: 26825384 },
        delay: 32.29
    },
    load: {
        requests: { '8080':
            { total: 94, disconnects: 1, statusCodes: { '200': 61 } }
        },
        concurrents: { '8080': 23 },
        responseTimes: { '8080': { avg: 990, max: 1234 } },
        sockets: { http: { total: 19 }, https: { total: 49 } }
    }
});

describe('ops', () => {
    it('One port => two events created', (done) => {
        const testEvent = JSON.parse(testEventBase);
        const formattedEvent = lineProtocol.format(testEvent, {});
        expect(formattedEvent).to.equal(getExpectedMessage(['8080']));
    });
})
