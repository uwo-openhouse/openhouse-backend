const buildings = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Buildings Lambda', function () {
    describe('GET Requests', () => {
        const scanFn = jest.fn();
        const handler = buildings({
            dynamo: {
                scan: scanFn
            }
        });

        afterEach(() => {
            scanFn.mockClear();
        });

        test('returns buildings from the database', async () => {
            scanFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Middlesex College',
                    position: {
                        lat: 32.111,
                        lng: -10.222
                    },
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }]
            });

            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(JSON.parse(result.body)).toEqual([{
                name: "Middlesex College",
                position: {
                    lat: 32.111,
                    lng: -10.222
                },
                uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
            }]);
        });
    });

    describe('POST Requests', () => {
        const putFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                put: putFn
            }
        });

        afterEach(() => {
            putFn.mockClear();
        });

        test('accepts & writes a single valid building to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 }
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(JSON.parse(result.body)).toEqual({
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid buildings to the database', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 },
                }, {
                    name: 'Middlesex College',
                    position: { lat: 32.111, lng: -10.222 }
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putFn).toHaveBeenCalledTimes(2);
            expect(putFn).toHaveBeenCalledWith({
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putFn).toHaveBeenCalledWith({
                name: 'Middlesex College',
                position: { lat: 32.111, lng: -10.222 },
                uuid: expect.stringMatching(uuidRegex)
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Middlesex College',
                position: { lat: 32.111, lng: -10.222 },
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('rejects when a single building is invalid', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Middlesex College',
                    position: { lat: 32.111 }
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('position.lng');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of buildings contains an invalid building', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    position: { lat: 32.111, lng: -10.222 }
                }, {
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 },
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('name');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('PUT Requests', () => {
        const getFn = jest.fn();
        const putFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                get: getFn,
                put: putFn
            }
        });

        afterEach(() => {
            getFn.mockClear();
            putFn.mockClear();
        });

        test('accepts & updates a valid updated building to the database', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 }
                }),
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
            });
        });

        test('rejects when the building UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 }
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getFn).not.toHaveBeenCalled();
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the building UUID does not exist', async () => {
            getFn.mockResolvedValueOnce({});
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 }
                }),
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Building does not exist');
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated building is invalid', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lng: -12.222 }
                }),
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('position.lat');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Requests', () => {
        const deleteFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                delete: deleteFn
            }
        });

        afterEach(() => {
            deleteFn.mockClear();
        });

        test('accepts & deletes an building from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteFn).toHaveBeenCalledTimes(1);
            expect(deleteFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
        });

        test('rejects when the building UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteFn).not.toHaveBeenCalled();
        });
    })
});
