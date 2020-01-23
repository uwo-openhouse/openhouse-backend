const openHouses = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Open Houses Lambda', function () {
    describe('GET Requests', () => {
        const scanFn = jest.fn();
        const handler = openHouses({
            dynamo: {
                scan: scanFn
            }
        });

        afterEach(() => {
            scanFn.mockClear();
        });

        test('returns open houses from the database', async () => {
            scanFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false,
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }]
            });

            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(JSON.parse(result.body)).toEqual([{
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
            }]);
        });
    });

    describe('POST Requests', () => {
        const putFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                put: putFn
            }
        });

        afterEach(() => {
            putFn.mockClear();
        });

        test('accepts & writes a single valid open house to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(JSON.parse(result.body)).toEqual({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid open houses to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                }, {
                    name: 'Spring Open House 2020',
                    date: 1579620681,
                    info: 'Important Details',
                    visible: true
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putFn).toHaveBeenCalledTimes(2);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putFn).toHaveBeenCalledWith({
                name: 'Spring Open House 2020',
                date: 1579620681,
                info: 'Important Details',
                visible: true,
                uuid: expect.stringMatching(uuidRegex)
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Spring Open House 2020',
                date: 1579620681,
                info: 'Important Details',
                visible: true,
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('rejects when a single open house is invalid', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Spring Open House 2020',
                    info: 'Important Details',
                    visible: true
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('date');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of open houses contains an invalid open house', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false,
                }, {
                    name: 'Spring Open House 2020',
                    date: 1579620681,
                    visible: true
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('info');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('PUT Requests', () => {
        const getFn = jest.fn();
        const putFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                get: getFn,
                put: putFn
            }
        });

        afterEach(() => {
            getFn.mockClear();
            putFn.mockClear();
        });

        test('accepts & updates a valid updated open house to the database', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                }),
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
            });
        });

        test('rejects when open house UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getFn).not.toHaveBeenCalled();
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when open house UUID does not exist', async () => {
            getFn.mockResolvedValueOnce({});
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                }),
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Open House does not exist');
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated open house is invalid', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details'
                }),
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('visible');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Requests', () => {
        const deleteFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                delete: deleteFn
            }
        });

        afterEach(() => {
            deleteFn.mockClear();
        });

        test('accepts & deletes an open house from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteFn).toHaveBeenCalledTimes(1);
            expect(deleteFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
        });

        test('rejects when the open house UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteFn).not.toHaveBeenCalled();
        });
    })
});
