const status = require('http-status');
const UUIDv4 = require('uuid/v4');
const Joi = require('@hapi/joi');

const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: {
        'Access-Control-Allow-Origin': '*'
    }
});

const eventSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    area: Joi.string().uuid().required(),
    building: Joi.string().uuid().required(),
    room: Joi.string().required(),
    openHouse: Joi.string().uuid().required(),
    startTime: Joi.string().pattern(new RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$'), { name: 'HH:mm' }).required(),
    endTime: Joi.string().pattern(new RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$'), { name: 'HH:mm' }).required()
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return await getEvents(deps.dynamo);

            case 'POST':
                return await createEvent(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await updateEvent(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await deleteEvent(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.error(err);
        return response(status.INTERNAL_SERVER_ERROR, {
            error: err.message
        });
    }
};

async function getEvents(dynamo) {
    const data = await dynamo.scanEvents();

    for (const event of data.Items) {
        event.attendees = (await dynamo.getEventAttendees(event.uuid)).Item.attendees;
    }

    return response(status.OK, data.Items);
}

async function createEvent(dynamo, body) {
    const bodyEvents = [];

    if (Array.isArray(body)) {
        bodyEvents.push(...body);
    } else {
        bodyEvents.push(body);
    }

    const validEvents = [];
    for (let i = 0; i < bodyEvents.length; i++) {
        const { value: event, error } = eventSchema.validate(bodyEvents[i]);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((error) => error.message).join('; ') + ` for event with index ${i}`
            });
        }

        const verifyError = await verifyUUIDs(dynamo, event.openHouse, event.area, event.building);
        if (verifyError) {
            return response(status.BAD_REQUEST, { error: verifyError + ` for event with index ${i}` });
        }

        validEvents.push(event);
    }

    const createdEvents = [];
    for (const event of validEvents) {
        const uuid = UUIDv4();

        const newEvent = {
            uuid,
            ...event
        };
        const newAttendees = {
            uuid,
            attendees: 0
        };

        await dynamo.putEvent(newEvent);
        await dynamo.putEventAttendees(newAttendees);

        createdEvents.push({
            ...newEvent,
            ...newAttendees
        });
    }

    return response(status.CREATED, Array.isArray(body) ? createdEvents : createdEvents[0]);
}

async function updateEvent(dynamo, uuid, body) {
    // Check to ensure uuid exists first
    const existingData = await dynamo.getEvent(uuid);
    if (!existingData.Item) {
        return response(status.NOT_FOUND, { error: 'Event does not exist' });
    }

    const { value: event, error } = eventSchema.validate(body);
    if (error) {
        return response(status.BAD_REQUEST, {
            error: error.details.map((detail) => detail.message).join('; ')
        });
    }

    const verifyError = await verifyUUIDs(dynamo, event.openHouse, event.area, event.building);
    if (verifyError) {
        return response(status.BAD_REQUEST, { error: verifyError });
    }

    await dynamo.putEvent({ uuid, ...event });

    return response(status.OK);
}

async function deleteEvent(dynamo, uuid) {
    await dynamo.deleteEvent(uuid);
    await dynamo.deleteEventAttendees(uuid);

    return response(status.OK);
}

async function verifyUUIDs(dynamo, openHouseUUID, areasUUID, buildingUUID) {
    if (!await dynamo.openHouseExists(openHouseUUID)) {
        return 'Specified open house does not exist';
    }

    if (!await dynamo.areaExists(areasUUID)) {
        return 'Specified area does not exist';
    }

    if (!await dynamo.buildingExists(buildingUUID)) {
        return 'Specified building does not exist';
    }
}
