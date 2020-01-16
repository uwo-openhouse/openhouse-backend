const areasFunc = require('./index.js');
const status = require('http-status');

describe('Areas Lambda', function () {
    test('GET returns areas from database', async () => {
        const result = await areasFunc.handler({
            httpMethod: 'GET'
        }, {});

        const response = JSON.parse(result.body);
        expect(response.success).toEqual(true);
        expect(result.statusCode).toEqual(status.OK);
    });
});
