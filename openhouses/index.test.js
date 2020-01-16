const openHousesFunc = require('./index.js');
const status = require('http-status');

describe('Open Houses Lambda', function () {
    test('GET returns open houses from database', async () => {
        const result = await openHousesFunc.handler({
            httpMethod: 'GET'
        }, {});

        const response = JSON.parse(result.body);
        expect(response.success).toEqual(true);
        expect(result.statusCode).toEqual(status.OK);
    });
});
