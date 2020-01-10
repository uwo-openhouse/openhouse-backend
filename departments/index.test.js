const departmentsFunc = require('./index.js');
const status = require('http-status');

describe('Departments Lambda', function () {
    test('GET returns departments from database', async () => {
        const result = await departmentsFunc.handler({
            httpMethod: 'GET'
        }, {});

        const response = JSON.parse(result.body);
        expect(response.success).toEqual(true);
        expect(result.statusCode).toEqual(status.OK);
    });
});
