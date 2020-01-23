const events = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Open Houses Lambda', function () {
    beforeAll(() => {
        process.env.EVENTS_TABLE = 'eventsTable';
        process.env.BUILDINGS_TABLE = 'buildingsTable';
        process.env.AREAS_TABLE = 'areasTable';
        process.env.OPEN_HOUSES_TABLE = 'openHousesTable';
    });

    describe('GET Requests', () => {
        const scanFn = jest.fn();
        const handler = events({
            dynamo: {
                scan: scanFn
            }
        });

        afterEach(() => {
            scanFn.mockClear();
        });

        test('returns events from the database', async () => {
            scanFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }]
            });

            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(JSON.parse(result.body)).toEqual([{
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
            }]);
        });
    });

    describe('POST Requests', () => {
        const putFn = jest.fn().mockResolvedValue({});
        const getFn = jest.fn();
        const handler = events({
            dynamo: {
                get: getFn,
                put: putFn
            }
        });

        afterEach(() => {
            putFn.mockClear();
        });

        test('accepts & writes a single valid open house to the database', async () => {
            getFn.mockResolvedValue({ Item: {} });
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00'
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(getFn).toHaveBeenCalledTimes(3);
            expect(getFn).toHaveBeenCalledWith(process.env.OPEN_HOUSES_TABLE, 'e3a8d98f-775a-46da-b977-f2fe1fa6f360');
            expect(getFn).toHaveBeenCalledWith(process.env.AREAS_TABLE, 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e');
            expect(getFn).toHaveBeenCalledWith(process.env.BUILDINGS_TABLE, '89bb0745-b18d-4b8e-913c-4c768012c14d');
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(JSON.parse(result.body)).toEqual({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid events to the database', async () => {
            getFn.mockResolvedValue({ Item: {} });
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00'
                }, {
                    name: 'Engineering Presentation',
                    description: 'Engineery stuff',
                    area: 'ca794597-0400-474f-a7f3-aaace942a418',
                    building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                    openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                    room: '400',
                    time: '07:00'
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putFn).toHaveBeenCalledTimes(2);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putFn).toHaveBeenCalledWith({
                name: 'Engineering Presentation',
                description: 'Engineery stuff',
                area: 'ca794597-0400-474f-a7f3-aaace942a418',
                building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                room: '400',
                time: '07:00',
                uuid: expect.stringMatching(uuidRegex)
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Engineering Presentation',
                description: 'Engineery stuff',
                area: 'ca794597-0400-474f-a7f3-aaace942a418',
                building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                room: '400',
                time: '07:00',
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('rejects when a single event is invalid', async () => {
            getFn.mockResolvedValue({ Item: {} });
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of events contains an invalid event', async () => {
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    room: '2300',
                    time: '05:00'
                }, {
                    name: 'Engineering Presentation',
                    description: 'Engineery stuff',
                    area: 'ca794597-0400-474f-a7f3-aaace942a418',
                    building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                    openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                    room: '400',
                    time: '07:00'
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('openHouse');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent open house', async () => {
            getFn.mockImplementation((table) => (table === process.env.OPEN_HOUSES_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('open house');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent area', async () => {
            getFn.mockImplementation((table) => (table === process.env.AREAS_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent building', async () => {
            getFn.mockImplementation((table) => (table === process.env.BUILDINGS_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('PUT Requests', () => {
        const getFn = jest.fn();
        const putFn = jest.fn().mockResolvedValue({});
        const handler = events({
            dynamo: {
                get: getFn,
                put: putFn
            }
        });

        afterEach(() => {
            getFn.mockClear();
            putFn.mockClear();
        });

        test('accepts & updates a valid updated event to the database', async () => {
            getFn.mockResolvedValue({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00'
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getFn).toHaveBeenCalledTimes(4);
            expect(getFn).toHaveBeenCalledWith(process.env.EVENTS_TABLE, 'ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(getFn).toHaveBeenCalledWith(process.env.OPEN_HOUSES_TABLE, 'e3a8d98f-775a-46da-b977-f2fe1fa6f360');
            expect(getFn).toHaveBeenCalledWith(process.env.AREAS_TABLE, 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e');
            expect(getFn).toHaveBeenCalledWith(process.env.BUILDINGS_TABLE, '89bb0745-b18d-4b8e-913c-4c768012c14d');
            expect(putFn).toHaveBeenCalledTimes(1);
            expect(putFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                time: '05:00',
                uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
            });
        });

        test('rejects when the event UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00'
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getFn).not.toHaveBeenCalled();
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the event UUID does not exist', async () => {
            getFn.mockResolvedValueOnce({});
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00'
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Event does not exist');
            expect(getFn).toHaveBeenCalledTimes(1);
            expect(getFn).toHaveBeenCalledWith(process.env.EVENTS_TABLE, 'ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event is invalid', async () => {
            getFn.mockResolvedValueOnce({ Item: {} });
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    time: '05:00'
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('room');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent open house', async () => {
            getFn.mockImplementation((table) => (table === process.env.OPEN_HOUSES_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('open house');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent area', async () => {
            getFn.mockImplementation((table) => (table === process.env.AREAS_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent building', async () => {
            getFn.mockImplementation((table) => (table === process.env.BUILDINGS_TABLE ? {} : { Item: {} }));
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    time: '05:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Requests', () => {
        const deleteFn = jest.fn().mockResolvedValue({});
        const handler = events({
            dynamo: {
                delete: deleteFn
            }
        });

        afterEach(() => {
            deleteFn.mockClear();
        });

        test('accepts & deletes an event from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteFn).toHaveBeenCalledTimes(1);
            expect(deleteFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
        });

        test('rejects when the event UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteFn).not.toHaveBeenCalled();
        });
    })
});
