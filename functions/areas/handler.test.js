const areas = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Areas Lambda', function () {
    beforeAll(() => {
        process.env.ORIGIN = 'https://uwo-test-origin.io'
    });

    describe('GET Requests', () => {
        const scanAreasFn = jest.fn();
        const handler = areas({
            dynamo: {
                scanAreas: scanAreasFn
            }
        });

        afterEach(() => {
            scanAreasFn.mockReset();
        });

        test('returns areas from the database', async () => {
            scanAreasFn.mockResolvedValueOnce({
                Items: [{
                    name: "Faculty of Testing",
                    color: '#FFF',
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }]
            });
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(JSON.parse(result.body)).toEqual([{
                name: "Faculty of Testing",
                color: '#FFF',
                uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
            }]);
        });

        test('contains correct Allow-Origin CORS header', async () => {
            scanAreasFn.mockResolvedValueOnce({
                Items: [{
                    name: "Faculty of Testing",
                    color: '#FFF',
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }]
            });
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://uwo-test-origin.io');
        });

        test('responds with a message when a database error occurs', async () => {
            scanAreasFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('POST Requests', () => {
        const createAreasFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                createAreas: createAreasFn
            }
        });

        afterEach(() => {
            createAreasFn.mockClear();
        });

        test('accepts & writes a single valid area to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Faculty of Testing',
                    color: '#000'
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(createAreasFn).toHaveBeenCalledTimes(1);
            expect(createAreasFn).toHaveBeenCalledWith([{
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            }]);
            expect(JSON.parse(result.body)).toEqual({
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid areas to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Faculty of Testing',
                    color: '#000'
                }, {
                    name: 'Faculty of Testing #2',
                    color: '#ccc'
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(createAreasFn).toHaveBeenCalledTimes(1);
            expect(createAreasFn).toHaveBeenCalledWith([{
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Faculty of Testing #2',
                color: '#ccc',
                uuid: expect.stringMatching(uuidRegex)
            }]);

            expect(JSON.parse(result.body)).toEqual([{
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Faculty of Testing #2',
                color: '#ccc',
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('contains correct Allow-Origin CORS header', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Faculty of Testing',
                    color: '#000'
                })
            });

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://uwo-test-origin.io');
        });

        test('rejects when a single area is invalid', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Faculty of Testing'
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('color');
            expect(createAreasFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of areas contains an invalid area', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Faculty of Testing',
                    color: '#000'
                }, {
                    name: 'Faculty of Testing #2',
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('color');
            expect(createAreasFn).not.toHaveBeenCalled();
        });

        test('responds with a message when a database error occurs', async () => {
            createAreasFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Faculty of Testing',
                    color: '#000'
                })
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('PUT Requests', () => {
        const getAreaFn = jest.fn();
        const putAreaFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                getArea: getAreaFn,
                putArea: putAreaFn
            }
        });

        afterEach(() => {
            getAreaFn.mockReset();
            putAreaFn.mockClear();
        });

        test('accepts & updates a valid updated area to the database', async () => {
            getAreaFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Faculty of Testing Updated',
                    color: '#bbb'
                }),
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getAreaFn).toHaveBeenCalledTimes(1);
            expect(getAreaFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
            expect(putAreaFn).toHaveBeenCalledTimes(1);
            expect(putAreaFn).toHaveBeenCalledWith({
                name: 'Faculty of Testing Updated',
                color: '#bbb',
                uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
            });
        });

        test('contains correct Allow-Origin CORS header', async () => {
            getAreaFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Faculty of Testing Updated',
                    color: '#bbb'
                }),
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://uwo-test-origin.io');
        });

        test('rejects when the area UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Faculty of Testing Updated',
                    color: '#bbb'
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getAreaFn).not.toHaveBeenCalled();
            expect(putAreaFn).not.toHaveBeenCalled();
        });

        test('rejects when the area UUID does not exist', async () => {
            getAreaFn.mockResolvedValueOnce({});
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Faculty of Testing Updated',
                    color: '#bbb'
                }),
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Area does not exist');
            expect(getAreaFn).toHaveBeenCalledTimes(1);
            expect(getAreaFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
            expect(putAreaFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated area is invalid', async () => {
            getAreaFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    color: '#bbb'
                }),
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('name');
            expect(putAreaFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            getAreaFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Faculty of Testing Updated',
                    color: '#bbb'
                }),
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('DELETE Requests', () => {
        const deleteAreaFn = jest.fn().mockResolvedValue({});
        const scanEventsFn = jest.fn();
        const deleteEventsFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                deleteArea: deleteAreaFn,
                scanEvents: scanEventsFn,
                deleteEvents: deleteEventsFn
            }
        });

        afterEach(() => {
            deleteAreaFn.mockClear();
            scanEventsFn.mockReset();
            deleteEventsFn.mockClear();
        });

        test('accepts & deletes an area from the database', async () => {
            scanEventsFn.mockResolvedValueOnce({ Items: [] });
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteEventsFn).not.toHaveBeenCalled();
            expect(deleteAreaFn).toHaveBeenCalledTimes(1);
            expect(deleteAreaFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
        });

        test('contains correct Allow-Origin CORS header', async () => {
            scanEventsFn.mockResolvedValueOnce({ Items: [] });
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://uwo-test-origin.io');
        });

        test('deletes events containing the area\'s UUID', async () => {
            scanEventsFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'fee567a4-c080-4ce9-8771-50aba119ecb1',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }]
            });
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteEventsFn).toHaveBeenCalledWith(['ccfb14f5-41a7-4514-9aac-28440981c21a']);
        });

        test('rejects when the area UUID is missing', async () => {
            scanEventsFn.mockResolvedValueOnce({ Items: [] });
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteAreaFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            scanEventsFn.mockResolvedValueOnce({ Items: [] });
            deleteAreaFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    })
});
