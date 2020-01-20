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
const headers = {
    'Access-Control-Allow-Origin': '*'
};

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
                    return {
                        statusCode: status.BAD_REQUEST,
                        body: JSON.stringify({
                            error: 'Missing UUID in URL path'
                        }),
                        headers
                    }
                }
                return updateEvent(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return {
                        statusCode: status.BAD_REQUEST,
                        body: JSON.stringify({
                            error: 'Missing UUID in URL path'
                        }),
                        headers
                    }
                }
                return deleteEvent(event.pathParameters.uuid);

            default:
                return {
                    statusCode: status.METHOD_NOT_ALLOWED,
                    headers
                };
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
        return {
            statusCode: status.OK,
            body: JSON.stringify(data.Items),
            headers
        };
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
                return {
                    statusCode: status.BAD_REQUEST,
                    body: JSON.stringify({
                        error: error.details.map((error) => error.message).join('; ') + ` for event with index ${i}`
                    }),
                    headers
                }
            }

            const verifyError = await verifyUUIDs(event.openHouse, event.area, event.building);
            if (verifyError) {
                return {
                    statusCode: status.BAD_REQUEST,
                    body: JSON.stringify({
                        error: verifyError + ` for event with index ${i}`
                    }),
                    headers
                }
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

        return {
            statusCode: status.CREATED,
            body: JSON.stringify(Array.isArray(body) ? newEvents : newEvents[0]),
            headers
        };
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
            return {
                statusCode: status.NOT_FOUND,
                body: JSON.stringify({
                    error: 'Event does not exist'
                }),
                headers
            }
        }

        const { value: event, error } = eventSchema.validate(body);
        if (error) {
            return {
                statusCode: status.BAD_REQUEST,
                body: JSON.stringify({
                    error: error.details.map((detail) => detail.message).join('; ')
                }),
                headers
            }
        }

        const verifyError = await verifyUUIDs(event.openHouse, event.area, event.building);
        if (verifyError) {
            return {
                statusCode: status.BAD_REQUEST,
                body: JSON.stringify({
                    error: verifyError
                }),
                headers
            }
        }

        // Save new building item
        await ddb.put({
            TableName: EVENTS_TABLE,
            Item: {
                uuid,
                ...event
            }
        }).promise();

        return {
            statusCode: status.OK,
            headers
        };
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

        return {
            statusCode: status.OK,
            headers
        };
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