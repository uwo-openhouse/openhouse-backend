const areas = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Areas Lambda', function () {
    describe('GET Requests', () => {
        const scanFn = jest.fn();
        const handler = areas({
            dynamo: {
                scan: scanFn
            }
        });

        afterEach(() => {
            scanFn.mockClear();
        });

        test('returns areas from the database', async () => {
            scanFn.mockResolvedValueOnce({
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
    });

    describe('POST Requests', () => {
        const putFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                put: putFn
            }
        });

        afterEach(() => {
            putFn.mockClear();
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
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            });
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
            expect(putFn).toHaveBeenCalledTimes(2);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Faculty of Testing',
                color: '#000',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putFn).toHaveBeenCalledWith({
                name: 'Faculty of Testing #2',
                color: '#ccc',
                uuid: expect.stringMatching(uuidRegex)
            });

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

        test('rejects when a single area is invalid', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Faculty of Testing'
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('color');
            expect(putFn).not.toHaveBeenCalled();
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
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('PUT Requests', () => {
        const getFn = jest.fn();
        const putFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                get: getFn,
                put: putFn
            }
        });

        afterEach(() => {
            getFn.mockClear();
            putFn.mockClear();
        });

        test('accepts & updates a valid updated area to the database', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
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
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Faculty of Testing Updated',
                color: '#bbb',
                uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
            });
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
            expect(getFn).not.toHaveBeenCalled();
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the area UUID does not exist', async () => {
            getFn.mockResolvedValueOnce({});
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
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated area is invalid', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
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
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Requests', () => {
        const deleteFn = jest.fn().mockResolvedValue({});
        const handler = areas({
            dynamo: {
                delete: deleteFn
            }
        });

        afterEach(() => {
            deleteFn.mockClear();
        });

        test('accepts & deletes an area from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'fee567a4-c080-4ce9-8771-50aba119ecb1'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteFn).toHaveBeenCalledTimes(1);
            expect(deleteFn).toHaveBeenCalledWith('fee567a4-c080-4ce9-8771-50aba119ecb1');
        });

        test('rejects when the area UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteFn).not.toHaveBeenCalled();
        });
    })
});
