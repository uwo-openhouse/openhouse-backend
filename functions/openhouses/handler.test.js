const openHouses = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Open Houses Lambda', function () {
    describe('GET Requests', () => {
        const scanOpenHousesFn = jest.fn();
        const getOpenHouseAttendeesFn = jest.fn();
        const handler = openHouses({
            dynamo: {
                scanOpenHouses: scanOpenHousesFn,
                getOpenHouseAttendees: getOpenHouseAttendeesFn
            }
        });

        afterEach(() => {
            scanOpenHousesFn.mockReset();
            getOpenHouseAttendeesFn.mockReset();
        });

        test('returns open houses from the database', async () => {
            scanOpenHousesFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false,
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }]
            });
            getOpenHouseAttendeesFn.mockResolvedValueOnce({
                Item: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d',
                    attendees: 3
                }
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
                uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d',
                attendees: 3
            }]);
        });

        test('responds with a message when a database error occurs', async () => {
            scanOpenHousesFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('POST Requests', () => {
        const putOpenHouseFn = jest.fn().mockResolvedValue({});
        const putOpenHouseAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                putOpenHouse: putOpenHouseFn,
                putOpenHouseAttendees: putOpenHouseAttendeesFn
            }
        });

        afterEach(() => {
            putOpenHouseFn.mockClear();
            putOpenHouseAttendeesFn.mockReset();
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
            expect(putOpenHouseFn).toHaveBeenCalledTimes(1);
            expect(putOpenHouseFn).toHaveBeenCalledWith({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putOpenHouseAttendeesFn).toHaveBeenCalledTimes(1);
            expect(putOpenHouseAttendeesFn).toHaveBeenCalledWith({
                uuid: expect.stringMatching(uuidRegex),
                attendees: 0
            });
            expect(JSON.parse(result.body)).toEqual({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                attendees: 0,
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
            expect(putOpenHouseFn).toHaveBeenCalledTimes(2);
            expect(putOpenHouseFn).toHaveBeenCalledWith({
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putOpenHouseFn).toHaveBeenCalledWith({
                name: 'Spring Open House 2020',
                date: 1579620681,
                info: 'Important Details',
                visible: true,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putOpenHouseAttendeesFn).toHaveBeenCalledTimes(2);
            expect(putOpenHouseAttendeesFn).toHaveBeenCalledWith({
                uuid: expect.stringMatching(uuidRegex),
                attendees: 0
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'Fall Open House 2020',
                date: 1579660681,
                info: 'Important Details',
                visible: false,
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Spring Open House 2020',
                date: 1579620681,
                info: 'Important Details',
                visible: true,
                attendees: 0,
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
            expect(putOpenHouseFn).not.toHaveBeenCalled();
            expect(putOpenHouseAttendeesFn).not.toHaveBeenCalled();
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
            expect(putOpenHouseFn).not.toHaveBeenCalled();
            expect(putOpenHouseAttendeesFn).not.toHaveBeenCalled();
        });

        test('responds with a message when a database error occurs', async () => {
            putOpenHouseFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Fall Open House 2020',
                    date: 1579660681,
                    info: 'Important Details',
                    visible: false
                })
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('PUT Requests', () => {
        const getOpenHouseFn = jest.fn();
        const putOpenHouseFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                getOpenHouse: getOpenHouseFn,
                putOpenHouse: putOpenHouseFn
            }
        });

        afterEach(() => {
            getOpenHouseFn.mockReset();
            putOpenHouseFn.mockClear();
        });

        test('accepts & updates a valid updated open house to the database', async () => {
            getOpenHouseFn.mockResolvedValueOnce({ Item: {} });
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
            expect(getOpenHouseFn).toHaveBeenCalledTimes(1);
            expect(getOpenHouseFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
            expect(putOpenHouseFn).toHaveBeenCalledTimes(1);
            expect(putOpenHouseFn).toHaveBeenCalledWith({
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
            expect(getOpenHouseFn).not.toHaveBeenCalled();
            expect(putOpenHouseFn).not.toHaveBeenCalled();
        });

        test('rejects when open house UUID does not exist', async () => {
            getOpenHouseFn.mockResolvedValueOnce({});
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
            expect(getOpenHouseFn).toHaveBeenCalledTimes(1);
            expect(getOpenHouseFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
            expect(putOpenHouseFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated open house is invalid', async () => {
            getOpenHouseFn.mockResolvedValueOnce({ Item: {} });
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
            expect(putOpenHouseFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            getOpenHouseFn.mockRejectedValueOnce(new Error('testError'));
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

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('DELETE Requests', () => {
        const deleteOpenHouseFn = jest.fn().mockResolvedValue({});
        const deleteOpenHouseAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = openHouses({
            dynamo: {
                deleteOpenHouse: deleteOpenHouseFn,
                deleteOpenHouseAttendees: deleteOpenHouseAttendeesFn
            }
        });

        afterEach(() => {
            deleteOpenHouseFn.mockClear();
            deleteOpenHouseAttendeesFn.mockClear();
        });

        test('accepts & deletes an open house from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteOpenHouseFn).toHaveBeenCalledTimes(1);
            expect(deleteOpenHouseFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
            expect(deleteOpenHouseAttendeesFn).toHaveBeenCalledTimes(1);
            expect(deleteOpenHouseAttendeesFn).toHaveBeenCalledWith('db028071-7e1d-4d6b-8999-d3111b558f8d');
        });

        test('rejects when the open house UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteOpenHouseFn).not.toHaveBeenCalled();
            expect(deleteOpenHouseAttendeesFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            deleteOpenHouseFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'db028071-7e1d-4d6b-8999-d3111b558f8d'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    })
});
