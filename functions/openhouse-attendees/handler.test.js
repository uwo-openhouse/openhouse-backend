const openHouseAttendees = require('./handler.js');
const status = require('http-status');

describe('Open House Attendees Lambda', function () {
    describe('POST Request (Increment)', () => {
        const attendeesExistFn = jest.fn();
        const incrementAttendeesFn = jest.fn().mockResolvedValue({});
        const handler = openHouseAttendees({
            dynamo: {
                attendeesExist: attendeesExistFn,
                incrementAttendees: incrementAttendeesFn
            }
        });

        afterEach(() => {
            attendeesExistFn.mockReset();
            incrementAttendeesFn.mockClear();
        });

        test('accepts an existent open house increment & updates the database', async () => {
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

        test('rejects when the open house UUID does not exist', async () => {
            attendeesExistFn.mockResolvedValueOnce(false);
            const result = await handler({
                httpMethod: 'POST',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.NOT_FOUND);
            expect(JSON.parse(result.body).error).toEqual('Open house does not exist');
            expect(attendeesExistFn).toHaveBeenCalledWith('ccfb14f5-41a7-4514-9aac-28440981c21a');
            expect(incrementAttendeesFn).not.toHaveBeenCalled();
        });

        test('responds with an error when a database error occurs', async () => {
            attendeesExistFn.mockRejectedValueOnce(new Error('testError'));
            const result = await handler({
                httpMethod: 'POST',
                pathParameters: {
                    uuid: 'ccfb14f5-41a7-4514-9aac-28440981c21a'
                }
            });

            expect(result.statusCode).toEqual(status.INTERNAL_SERVER_ERROR);
            expect(JSON.parse(result.body)).toEqual({ error: 'testError' });
        });
    });
});
