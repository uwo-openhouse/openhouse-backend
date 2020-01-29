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
                return getEvents(deps.dynamo);

            case 'POST':
                return createEvent(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateEvent(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteEvent(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getEvents(dynamo) {
    try {
        const data = await dynamo.scan();

        // TODO: Only return events that belong to a visible=true open house when admin is not authenticated
        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createEvent(dynamo, body) {
    try {
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

        const newEvents = [];
        for (const event of validEvents) {
            const newEvent = {
                uuid: UUIDv4(),
                ...event
            };

            await dynamo.put(newEvent);
            newEvents.push(newEvent);
        }

        return response(status.CREATED, Array.isArray(body) ? newEvents : newEvents[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateEvent(dynamo, uuid, body) {
    const { EVENTS_TABLE } = process.env;

    try {
        // Check to ensure uuid exists first
        const existingData = await dynamo.get(EVENTS_TABLE, uuid);
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

        // Save new building item
        await dynamo.put({ uuid, ...event });

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteEvent(dynamo, uuid) {
    try {
        await dynamo.delete(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function verifyUUIDs(dynamo, openHouseUUID, areasUUID, buildingUUID) {
    const {
        BUILDINGS_TABLE,
        AREAS_TABLE,
        OPEN_HOUSES_TABLE
    } = process.env;

    const openHouseData = await dynamo.get(OPEN_HOUSES_TABLE, openHouseUUID);
    if (!openHouseData.Item) {
        return 'Specified open house does not exist';
    }

    const areaData = await dynamo.get(AREAS_TABLE, areasUUID);
    if (!areaData.Item) {
        return 'Specified area does not exist';
    }

    const buildingData = await dynamo.get(BUILDINGS_TABLE, buildingUUID);
    if (!buildingData.Item) {
        return 'Specified building does not exist';
    }
}
