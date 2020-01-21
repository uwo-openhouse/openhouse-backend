const aws = require('aws-sdk');
const status = require('http-status');
const UUIDv4 = require('uuid/v4');
const Joi = require('@hapi/joi');

aws.config.update({ region: 'us-east-2' });
const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const {
    EVENTS_TABLE,
    BUILDINGS_TABLE,
    AREAS_TABLE,
    OPEN_HOUSES_TABLE
} = process.env;

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
    time: Joi.string().pattern(new RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$'), { name: 'HH:mm' }).required()
});

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getEvents();

            case 'POST':
                return createEvent(JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateEvent(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteEvent(event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getEvents() {
    try {
        const data = await ddb.scan({ TableName: EVENTS_TABLE }).promise();

        // TODO: Only return events that belong to a visible=true open house when admin is not authenticated
        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createEvent(body) {
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

            const verifyError = await verifyUUIDs(event.openHouse, event.area, event.building);
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

            await ddb.put({
                TableName: EVENTS_TABLE,
                Item: newEvent
            }).promise();

            newEvents.push(newEvent);
        }

        return response(status.CREATED, Array.isArray(body) ? newEvents : newEvents[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateEvent(uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await ddb.get({
            TableName: EVENTS_TABLE,
            Key: { uuid }
        }).promise();
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Event does not exist' });
        }

        const { value: event, error } = eventSchema.validate(body);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((detail) => detail.message).join('; ')
            });
        }

        const verifyError = await verifyUUIDs(event.openHouse, event.area, event.building);
        if (verifyError) {
            return response(status.BAD_REQUEST, { error: verifyError });
        }

        // Save new building item
        await ddb.put({
            TableName: EVENTS_TABLE,
            Item: {
                uuid,
                ...event
            }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteEvent(uuid) {
    try {
        await ddb.delete({
            TableName: EVENTS_TABLE,
            Key: { uuid }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function verifyUUIDs(openHouseUUID, areasUUID, buildingUUID) {
    const openHouseData = await ddb.get({
        TableName: OPEN_HOUSES_TABLE,
        Key: { uuid: openHouseUUID }
    }).promise();
    if (!openHouseData.Item) {
        return 'Specified open house does not exist';
    }

    const areaData = await ddb.get({
        TableName: AREAS_TABLE,
        Key: { uuid: areasUUID }
    }).promise();
    if (!areaData.Item) {
        return 'Specified area does not exist';
    }

    const buildingData = await ddb.get({
        TableName: BUILDINGS_TABLE,
        Key: { uuid: buildingUUID }
    }).promise();
    if (!buildingData.Item) {
        return 'Specified building does not exist';
    }
}
