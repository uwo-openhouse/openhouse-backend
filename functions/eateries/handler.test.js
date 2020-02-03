const eateries = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Eateries Lambda', function () {
    describe('GET Requests', () => {
        const scanEateriesFn = jest.fn();
        const handler = eateries({
            dynamo: {
                scanEateries: scanEateriesFn
            }
        });

        afterEach(() => {
            scanEateriesFn.mockReset();
        });

        test('returns eateries from the database', async () => {
            scanEateriesFn.mockResolvedValueOnce({
                Items: [{
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    uuid: 'b77afbf8-25a9-4752-90a3-93167e886245',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                }]
            });

            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(JSON.parse(result.body)).toEqual([{
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                uuid: 'b77afbf8-25a9-4752-90a3-93167e886245',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
            }]);
        });
    });

    describe('POST Requests', () => {
        const putEateryFn = jest.fn().mockResolvedValue({});
        const buildingExistsFn = jest.fn();
        const handler = eateries({
            dynamo: {
                putEatery: putEateryFn,
                buildingExists: buildingExistsFn
            }
        });

        afterEach(() => {
            putEateryFn.mockClear();
            buildingExistsFn.mockReset();
        });

        test('accepts & writes a single valid eatery to the database', async () => {
            buildingExistsFn.mockResolvedValueOnce(true);
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putEateryFn).toHaveBeenCalledTimes(1);
            expect(putEateryFn).toHaveBeenCalledWith({
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(buildingExistsFn).toHaveBeenCalledWith('0b16d09b-bd73-4849-83f7-b3bcec909e20');
            expect(JSON.parse(result.body)).toEqual({
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid eateries to the database', async () => {
            buildingExistsFn.mockResolvedValue(true);
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                }, {
                    name: 'Tim Hortons',
                    openTime: '8:00',
                    closeTime: '17:00',
                    building: 'f16ab4ca-71f8-43bb-8762-62d9cffe3cc8'
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putEateryFn).toHaveBeenCalledTimes(2);
            expect(putEateryFn).toHaveBeenCalledWith({
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putEateryFn).toHaveBeenCalledWith({
                name: 'Tim Hortons',
                openTime: '8:00',
                closeTime: '17:00',
                building: 'f16ab4ca-71f8-43bb-8762-62d9cffe3cc8',
                uuid: expect.stringMatching(uuidRegex)
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Tim Hortons',
                openTime: '8:00',
                closeTime: '17:00',
                building: 'f16ab4ca-71f8-43bb-8762-62d9cffe3cc8',
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('rejects when a single eatery is invalid', async () => {
            buildingExistsFn.mockResolvedValue(true);
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Tim Hortons',
                    closeTime: '17:00',
                    building: 'f16ab4ca-71f8-43bb-8762-62d9cffe3cc8',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('openTime');
            expect(putEateryFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of eateries contains an invalid eatery', async () => {
            buildingExistsFn.mockResolvedValue(true);
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                }, {
                    openTime: '8:00',
                    closeTime: '17:00',
                    building: 'f16ab4ca-71f8-43bb-8762-62d9cffe3cc8',
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('name');
            expect(putEateryFn).not.toHaveBeenCalled();
        });

        test('rejects when an eatery has a non-existent building', async () => {
            buildingExistsFn.mockResolvedValueOnce(false);
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putEateryFn).not.toHaveBeenCalled();
        });
    });

    describe('PUT Requests', () => {
        const getEateryFn = jest.fn();
        const putEateryFn = jest.fn().mockResolvedValue({});
        const buildingExistsFn = jest.fn();
        const handler = eateries({
            dynamo: {
                getEatery: getEateryFn,
                putEatery: putEateryFn,
                buildingExists: buildingExistsFn
            }
        });

        afterEach(() => {
            getEateryFn.mockReset();
            putEateryFn.mockClear();
            buildingExistsFn.mockReset();
        });

        test('accepts & updates a valid updated eatery to the database', async () => {
            getEateryFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(true);
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                }),
                pathParameters: {
                    uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getEateryFn).toHaveBeenCalledTimes(1);
            expect(getEateryFn).toHaveBeenCalledWith('c24e551e-c914-4198-b3fc-d1d040f53a0f');
            expect(buildingExistsFn).toHaveBeenCalledWith('0b16d09b-bd73-4849-83f7-b3bcec909e20');
            expect(putEateryFn).toHaveBeenCalledTimes(1);
            expect(putEateryFn).toHaveBeenCalledWith({
                name: 'The Grad Club',
                openTime: '10:00',
                closeTime: '22:00',
                building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
            });
        });

        test('rejects when the eatery UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getEateryFn).not.toHaveBeenCalled();
            expect(putEateryFn).not.toHaveBeenCalled();
        });

        test('rejects when the eatery UUID does not exist', async () => {
            getEateryFn.mockResolvedValueOnce({});
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20'
                }),
                pathParameters: {
                    uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Eatery does not exist');
            expect(getEateryFn).toHaveBeenCalledTimes(1);
            expect(getEateryFn).toHaveBeenCalledWith('c24e551e-c914-4198-b3fc-d1d040f53a0f');
            expect(putEateryFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated eatery is invalid', async () => {
            getEateryFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                }),
                pathParameters: {
                    uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('closeTime');
            expect(putEateryFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated eatery has a non-existent building', async () => {
            getEateryFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(false);
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'The Grad Club',
                    openTime: '10:00',
                    closeTime: '22:00',
                    building: '0b16d09b-bd73-4849-83f7-b3bcec909e20',
                }),
                pathParameters: {
                    uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putEateryFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Requests', () => {
        const deleteEateryFn = jest.fn().mockResolvedValue({});
        const handler = eateries({
            dynamo: {
                deleteEatery: deleteEateryFn
            }
        });

        afterEach(() => {
            deleteEateryFn.mockClear();
        });

        test('accepts & deletes an eatery from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'c24e551e-c914-4198-b3fc-d1d040f53a0f'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteEateryFn).toHaveBeenCalledTimes(1);
            expect(deleteEateryFn).toHaveBeenCalledWith('c24e551e-c914-4198-b3fc-d1d040f53a0f');
        });

        test('rejects when the eatery UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteEateryFn).not.toHaveBeenCalled();
        });
    })
});
