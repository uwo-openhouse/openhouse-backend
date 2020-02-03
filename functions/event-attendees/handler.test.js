const events = require('./handler.js');
const status = require('http-status');

describe('Event Attendees Lambda', function () {
    describe('POST Request (Increment)', () => {
        const attendeesExistFn = jest.fn();
        const incrementAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = events({
            dynamo: {
                attendeesExist: attendeesExistFn,
                incrementAttendees: incrementAttendeesFn
            }
        });

        afterEach(() => {
            attendeesExistFn.mockReset();
            incrementAttendeesFn.mockClear();
        });

        test('accepts an existent event increment & updates the database', async () => {
            attendeesExistFn.mockResolvedValueOnce(true);
            const result = await handler({
                httpMethod: 'POST',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(attendeesExistFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(incrementAttendeesFn).toHaveBeenCalledTimes(1);
            expect(incrementAttendeesFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
        });

        test('rejects when the event UUID does not exist', async () => {
            attendeesExistFn.mockResolvedValueOnce(false);
            const result = await handler({
                httpMethod: 'POST',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Event does not exist');
            expect(attendeesExistFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(incrementAttendeesFn).not.toHaveBeenCalled();
        });
    });

    describe('DELETE Request (Decrement)', () => {
        const attendeesExistFn = jest.fn();
        const decrementAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = events({
            dynamo: {
                attendeesExist: attendeesExistFn,
                decrementAttendees: decrementAttendeesFn
            }
        });

        afterEach(() => {
            attendeesExistFn.mockReset();
            decrementAttendeesFn.mockClear();
        });

        test('accepts an existent event decrement & updates the database', async () => {
            attendeesExistFn.mockResolvedValueOnce(true);
            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.OK);
            expect(attendeesExistFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(decrementAttendeesFn).toHaveBeenCalledTimes(1);
            expect(decrementAttendeesFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
        });

        test('rejects when the event UUID does not exist', async () => {
            attendeesExistFn.mockResolvedValueOnce(false);

            const result = await handler({
                httpMethod: 'DELETE',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Event does not exist');
            expect(attendeesExistFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(decrementAttendeesFn).not.toHaveBeenCalled();
        });
    })
});
