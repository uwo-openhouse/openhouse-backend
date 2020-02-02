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
        switch (event.httpMethod) {
            case 'POST':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return incrementAttendees(deps.dynamo, event.pathParameters.uuid);

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return decrementAttendees(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.error(err);
        return err;
    }
};

async function incrementAttendees(dynamo, uuid) {
    try {
        if (!await dynamo.attendeesExist(uuid)) {
            return response(status.NOT_FOUND, { error: 'Event does not exist' });
        }

        await dynamo.incrementAttendees(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function decrementAttendees(dynamo, uuid) {
    try {
        if (!await dynamo.attendeesExist(uuid)) {
            return response(status.NOT_FOUND, { error: 'Event does not exist' });
        }

        await dynamo.decrementAttendees(uuid);

        return response(status.OK);
    } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            console.log(`NOTICE: User attempted to decrement attendee count below 0 for event with UUID: ${uuid}`);
            return response(status.OK);
        }

        console.error(err);
        return err;
    }
}
