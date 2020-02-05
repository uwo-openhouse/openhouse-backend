const buildings = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Buildings Lambda', function () {
    describe('GET Requests', () => {
        const scanBuildingsFn = jest.fn();
        const handler = buildings({
            dynamo: {
                scanBuildings: scanBuildingsFn
            }
        });

        afterEach(() => {
            scanBuildingsFn.mockReset();
        });

        test('returns buildings from the database', async () => {
            scanBuildingsFn.mockResolvedValueOnce({
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

        test('responds with a message when a database error occurs', async () => {
            scanBuildingsFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('POST Requests', () => {
        const putBuildingFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                putBuilding: putBuildingFn
            }
        });

        afterEach(() => {
            putBuildingFn.mockClear();
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
            expect(putBuildingFn).toHaveBeenCalledTimes(1);
            expect(putBuildingFn).toHaveBeenCalledWith({
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
            expect(putBuildingFn).toHaveBeenCalledTimes(2);
            expect(putBuildingFn).toHaveBeenCalledWith({
                name: 'North Campus Building',
                position: { lat: 35.111, lng: -12.222 },
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putBuildingFn).toHaveBeenCalledWith({
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
            expect(putBuildingFn).not.toHaveBeenCalled();
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
            expect(putBuildingFn).not.toHaveBeenCalled();
        });

        test('responds with a message when a database error occurs', async () => {
            putBuildingFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'North Campus Building',
                    position: { lat: 35.111, lng: -12.222 }
                })
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('PUT Requests', () => {
        const getBuildingFn = jest.fn();
        const putBuildingFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                getBuilding: getBuildingFn,
                putBuilding: putBuildingFn
            }
        });

        afterEach(() => {
            getBuildingFn.mockReset();
            putBuildingFn.mockClear();
        });

        test('accepts & updates a valid updated building to the database', async () => {
            getBuildingFn.mockResolvedValueOnce({ Item: {} });
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
            expect(getBuildingFn).toHaveBeenCalledTimes(1);
            expect(getBuildingFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
            expect(putBuildingFn).toHaveBeenCalledTimes(1);
            expect(putBuildingFn).toHaveBeenCalledWith({
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
            expect(getBuildingFn).not.toHaveBeenCalled();
            expect(putBuildingFn).not.toHaveBeenCalled();
        });

        test('rejects when the building UUID does not exist', async () => {
            getBuildingFn.mockResolvedValueOnce({});
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
            expect(getBuildingFn).toHaveBeenCalledTimes(1);
            expect(getBuildingFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
            expect(putBuildingFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated building is invalid', async () => {
            getBuildingFn.mockResolvedValueOnce({ Item: {} });
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
            expect(putBuildingFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            getBuildingFn.mockRejectedValueOnce(new Error('testError'));
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

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('DELETE Requests', () => {
        const deleteBuildingFn = jest.fn().mockResolvedValue({});
        const handler = buildings({
            dynamo: {
                deleteBuilding: deleteBuildingFn
            }
        });

        afterEach(() => {
            deleteBuildingFn.mockClear();
        });

        test('accepts & deletes an building from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteBuildingFn).toHaveBeenCalledTimes(1);
            expect(deleteBuildingFn).toHaveBeenCalledWith('be8c6fbd-5af0-4c24-8da0-feff1d623c00');
        });

        test('rejects when the building UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteBuildingFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            deleteBuildingFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'be8c6fbd-5af0-4c24-8da0-feff1d623c00'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    })
});
