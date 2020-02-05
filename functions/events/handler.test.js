const events = require('./handler.js');
const status = require('http-status');

const uuidRegex = new RegExp('^[0-9a-f]{8}\\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\\b[0-9a-f]{12}$');

describe('Events Lambda', function () {
    describe('GET Requests', () => {
        const scanEventsFn = jest.fn();
        const getEventAttendeesFn = jest.fn();
        const handler = events({
            dynamo: {
                scanEvents: scanEventsFn,
                getEventAttendees: getEventAttendeesFn
            }
        });

        afterEach(() => {
            scanEventsFn.mockReset();
            getEventAttendeesFn.mockReset();
        });

        test('returns events from the database', async () => {
            scanEventsFn.mockResolvedValueOnce({
                Items: [{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }]
            });
            getEventAttendeesFn.mockResolvedValueOnce(({
                Item: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a',
                    attendees: 4
                }
            }));

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
                startTime: '05:00',
                endTime: '06:00',
                attendees: 4,
                uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
            }]);
        });

        test('responds with a message when a database error occurs', async () => {
            scanEventsFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'GET'
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('POST Requests', () => {
        const putEventFn = jest.fn().mockResolvedValue({});
        const putEventAttendeesFn = jest.fn().mockResolvedValue({});
        const buildingExistsFn = jest.fn();
        const areaExistsFn = jest.fn();
        const openHouseExistsFn = jest.fn();
        const handler = events({
            dynamo: {
                putEvent: putEventFn,
                putEventAttendees: putEventAttendeesFn,
                buildingExists: buildingExistsFn,
                areaExists: areaExistsFn,
                openHouseExists: openHouseExistsFn
            }
        });

        afterEach(() => {
            putEventFn.mockClear();
            putEventAttendeesFn.mockClear();
            buildingExistsFn.mockReset();
            areaExistsFn.mockReset();
            openHouseExistsFn.mockReset();
        });

        test('accepts & writes a single valid open house to the database', async () => {
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(openHouseExistsFn).toHaveBeenCalledWith('e3a8d98f-775a-46da-b977-f2fe1fa6f360');
            expect(areaExistsFn).toHaveBeenCalledWith('e1b0e6d0-b3b2-42bf-8d4c-9801f374989e');
            expect(buildingExistsFn).toHaveBeenCalledWith('89bb0745-b18d-4b8e-913c-4c768012c14d');
            expect(putEventFn).toHaveBeenCalledTimes(1);
            expect(putEventFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                startTime: '05:00',
                endTime: '06:00',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putEventAttendeesFn).toHaveBeenCalledTimes(1);
            expect(putEventAttendeesFn).toHaveBeenCalledWith({
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(JSON.parse(result.body)).toEqual({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                startTime: '05:00',
                endTime: '06:00',
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            });
        });

        test('accepts & writes a list of valid events to the database', async () => {
            buildingExistsFn.mockResolvedValue(true);
            areaExistsFn.mockResolvedValue(true);
            openHouseExistsFn.mockResolvedValue(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }, {
                    name: 'Engineering Presentation',
                    description: 'Engineery stuff',
                    area: 'ca794597-0400-474f-a7f3-aaace942a418',
                    building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                    openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                    room: '400',
                    startTime: '06:00',
                    endTime: '07:00',
                }])
            });

            expect(result.statusCode).toEqual(status.CREATED);
            expect(putEventFn).toHaveBeenCalledTimes(2);
            expect(putEventFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                startTime: '05:00',
                endTime: '06:00',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putEventFn).toHaveBeenCalledWith({
                name: 'Engineering Presentation',
                description: 'Engineery stuff',
                area: 'ca794597-0400-474f-a7f3-aaace942a418',
                building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                room: '400',
                startTime: '06:00',
                endTime: '07:00',
                uuid: expect.stringMatching(uuidRegex)
            });
            expect(putEventAttendeesFn).toHaveBeenCalledTimes(2);
            expect(putEventAttendeesFn).toHaveBeenCalledWith({
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            });

            expect(JSON.parse(result.body)).toEqual([{
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                startTime: '05:00',
                endTime: '06:00',
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            }, {
                name: 'Engineering Presentation',
                description: 'Engineery stuff',
                area: 'ca794597-0400-474f-a7f3-aaace942a418',
                building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                room: '400',
                startTime: '06:00',
                endTime: '07:00',
                attendees: 0,
                uuid: expect.stringMatching(uuidRegex)
            }])
        });

        test('rejects when a single event is invalid', async () => {
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putEventFn).not.toHaveBeenCalled();
            expect(putEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('rejects when a list of events contains an invalid event', async () => {
            buildingExistsFn.mockResolvedValue(true);
            areaExistsFn.mockResolvedValue(true);
            openHouseExistsFn.mockResolvedValue(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify([{
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }, {
                    name: 'Engineering Presentation',
                    description: 'Engineery stuff',
                    area: 'ca794597-0400-474f-a7f3-aaace942a418',
                    building: '16b81601-e89e-4ec6-a813-0528e7cf67f0',
                    openHouse: 'f5a92ea1-99e3-4063-8460-0bb518f0f388',
                    room: '400',
                    startTime: '06:00',
                    endTime: '07:00',
                }])
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('openHouse');
            expect(putEventFn).not.toHaveBeenCalled();
            expect(putEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent open house', async () => {
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(false);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('open house');
            expect(putEventFn).not.toHaveBeenCalled();
            expect(putEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent area', async () => {
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(false);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putEventFn).not.toHaveBeenCalled();
            expect(putEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('rejects when an event has a non-existent building', async () => {
            buildingExistsFn.mockResolvedValueOnce(false);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putEventFn).not.toHaveBeenCalled();
            expect(putEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('responds with a message when a database error occurs', async () => {
            openHouseExistsFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'POST',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                })
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('PUT Requests', () => {
        const putEventFn = jest.fn().mockResolvedValue({});
        const getEventFn = jest.fn();
        const buildingExistsFn = jest.fn();
        const areaExistsFn = jest.fn();
        const openHouseExistsFn = jest.fn();
        const handler = events({
            dynamo: {
                putEvent: putEventFn,
                getEvent: getEventFn,
                buildingExists: buildingExistsFn,
                areaExists: areaExistsFn,
                openHouseExists: openHouseExistsFn
            }
        });

        afterEach(() => {
            putEventFn.mockClear();
            getEventFn.mockReset();
            buildingExistsFn.mockReset();
            areaExistsFn.mockReset();
            openHouseExistsFn.mockReset();
        });

        test('accepts & updates a valid updated event to the database', async () => {
            getEventFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(getEventFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(openHouseExistsFn).toHaveBeenCalledWith('e3a8d98f-775a-46da-b977-f2fe1fa6f360');
            expect(areaExistsFn).toHaveBeenCalledWith('e1b0e6d0-b3b2-42bf-8d4c-9801f374989e');
            expect(buildingExistsFn).toHaveBeenCalledWith('89bb0745-b18d-4b8e-913c-4c768012c14d');
            expect(putEventFn).toHaveBeenCalledTimes(1);
            expect(putEventFn).toHaveBeenCalledWith({
                name: 'Science Presentation',
                description: 'Sciency stuff',
                area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                room: '2300',
                startTime: '05:00',
                endTime: '06:00',
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
                    startTime: '05:00',
                    endTime: '06:00',
                }),
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(getEventFn).not.toHaveBeenCalled();
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('rejects when the event UUID does not exist', async () => {
            getEventFn.mockResolvedValueOnce({});

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Event does not exist');
            expect(getEventFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event is invalid', async () => {
            getEventFn.mockResolvedValueOnce({ Item: {} });

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('room');
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent open house', async () => {
            getEventFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(false);

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('open house');
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent area', async () => {
            getEventFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(true);
            areaExistsFn.mockResolvedValueOnce(false);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('area');
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('rejects when the updated event has a non-existent building', async () => {
            getEventFn.mockResolvedValueOnce({ Item: {} });
            buildingExistsFn.mockResolvedValueOnce(false);
            areaExistsFn.mockResolvedValueOnce(true);
            openHouseExistsFn.mockResolvedValueOnce(true);

            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toMatch('building');
            expect(putEventFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            getEventFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'PUT',
                body: JSON.stringify({
                    name: 'Science Presentation',
                    description: 'Sciency stuff',
                    area: 'e1b0e6d0-b3b2-42bf-8d4c-9801f374989e',
                    building: '89bb0745-b18d-4b8e-913c-4c768012c14d',
                    openHouse: 'e3a8d98f-775a-46da-b977-f2fe1fa6f360',
                    room: '2300',
                    startTime: '05:00',
                    endTime: '06:00',
                }),
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });

    describe('DELETE Requests', () => {
        const deleteEventFn = jest.fn().mockResolvedValue({});
        const deleteEventAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = events({
            dynamo: {
                deleteEvent: deleteEventFn,
                deleteEventAttendees: deleteEventAttendeesFn
            }
        });

        afterEach(() => {
            deleteEventFn.mockClear();
            deleteEventAttendeesFn.mockClear();
        });

        test('accepts & deletes an event from the database', async () => {
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(deleteEventFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(deleteEventAttendeesFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
        });

        test('rejects when the event UUID is missing', async () => {
            const result = await handler({
                httpMethod: 'DELETE'
            });

            expect(result.statusCode).toEqual(status.BAD_REQUEST);
            expect(JSON.parse(result.body).error).toEqual('Missing UUID in URL path');
            expect(deleteEventFn).not.toHaveBeenCalled();
            expect(deleteEventAttendeesFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            deleteEventFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    })
});
