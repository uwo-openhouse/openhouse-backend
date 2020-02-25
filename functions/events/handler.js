const status = require('http-status');
const UUIDv4 = require('uuid/v4');
const Joi = require('@hapi/joi');

const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: {
        'Access-Control-Allow-Origin': process.env.ORIGIN
    }
});

const EMPTY_STRING_PLACEHOLDER = '#EMPTY_STRING#';

const eventSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    area: Joi.string().uuid().required(),
    building: Joi.string().uuid().required(),
    room: Joi.string().allow('').required(),
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
    const events = (await dynamo.scanEvents()).Items;

    if (events.length > 0) {
        const eventAttendees = await dynamo.getEventAttendees(events.map((event) => event.uuid));

        // Change array of eventAttendees objects to uuid => count map
        const attendeesMap = eventAttendees.reduce((map, eventAttendee) => {
            map[eventAttendee.uuid] = eventAttendee.attendees;
            return map;
        }, {});

        for (const event of events) {
            const attendees = attendeesMap[event.uuid];
            if (attendees != null) {
                event.attendees = attendees;
            }
        }
    }

    for (const event of events) {
        replaceEmptyStringPlaceholder(event);
    }

    return response(status.OK, events);
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

    for (const event of validEvents) {
        replaceEmptyString(event);
    }

    const createdEvents = [];
    const createdEventAttendees = [];
    const resultEvents = [];
    for (const event of validEvents) {
        const uuid = UUIDv4();

        createdEvents.push({
            uuid,
            ...event,
        });
        createdEventAttendees.push({
            uuid,
            attendees: 0
        });
        resultEvents.push({
            uuid,
            attendees: 0,
            ...event
        });
    }
    await dynamo.createEvents(createdEvents);
    await dynamo.createEventAttendees(createdEventAttendees);

    for (const event of resultEvents) {
        replaceEmptyStringPlaceholder(event);
    }

    return response(status.CREATED, Array.isArray(body) ? resultEvents : resultEvents[0]);
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

    replaceEmptyString(event);

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

function replaceEmptyString(event) {
    if (event.room === '') {
        event.room = EMPTY_STRING_PLACEHOLDER;
    }
}

function replaceEmptyStringPlaceholder(event) {
    if (event.room === EMPTY_STRING_PLACEHOLDER) {
        event.room = '';
    }
}
