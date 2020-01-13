const eventsFunc = require('./index.js');
const status = require('http-status');

describe('Events Lambda', function () {
    test('GET returns events from database', async () => {
        const result = await eventsFunc.handler({
            httpMethod: 'GET'
        }, {});

        const response = JSON.parse(result.body);
        expect(response.success).toEqual(true);
        expect(result.statusCode).toEqual(status.OK);
    });
});
