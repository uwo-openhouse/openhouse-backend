const buildingFunc = require('./index.js');
const status = require('http-status');

describe('Buildings Lambda', function () {
    test('GET returns buildings from database', async () => {
        const result = await buildingFunc.handler({
            httpMethod: 'GET'
        }, {});

        const response = JSON.parse(result.body);
        expect(response.success).toEqual(true);
        expect(result.statusCode).toEqual(status.OK);
    });
});
