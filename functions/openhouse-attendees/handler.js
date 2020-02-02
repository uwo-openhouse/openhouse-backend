const status = require('http-status');

const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: {
        'Access-Control-Allow-Origin': '*'
    }
});

module.exports = (deps) => async (event) => {
    try {
        const { dynamo } = deps;

        if (!event.pathParameters || !event.pathParameters.uuid) {
            return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
        }

        const uuid = event.pathParameters.uuid;
        if (!await dynamo.attendeesExist(uuid)) {
            return response(status.NOT_FOUND, { error: 'Open house does not exist' });
        }

        await dynamo.incrementAttendees(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
};
