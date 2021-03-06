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

const areaSchema = Joi.object({
    name: Joi.string().required(),
    color: Joi.string().regex(new RegExp('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'), { name: 'Hex Color Code' }).required()
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return await getAreas(deps.dynamo);

            case 'POST':
                return await createArea(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await updateArea(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await deleteArea(deps.dynamo, event.pathParameters.uuid);

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

async function getAreas(dynamo) {
    const data = await dynamo.scanAreas();

    return response(status.OK, data.Items);
}

async function createArea(dynamo, body) {
    const bodyAreas = [];

    if (Array.isArray(body)) {
        bodyAreas.push(...body);
    } else {
        bodyAreas.push(body);
    }

    const validAreas = [];
    for (let i = 0; i < bodyAreas.length; i++) {
        const { value: area, error } = areaSchema.validate(bodyAreas[i]);

        if (error) {

            return response(status.BAD_REQUEST, {
                error: error.details.map((error) => error.message).join('; ') + ` for area with index ${i}`
            });
        } else {
            validAreas.push(area);
        }
    }

    const createdAreas = [];
    for (const area of validAreas) {
        createdAreas.push({
            uuid: UUIDv4(),
            ...area
        });
    }
    await dynamo.createAreas(createdAreas);

    return response(status.CREATED, Array.isArray(body) ? createdAreas : createdAreas[0]);
}

async function updateArea(dynamo, uuid, body) {
    // Check to ensure uuid exists first
    const existingData = await dynamo.getArea(uuid);
    if (!existingData.Item) {
        return response(status.NOT_FOUND, { error: 'Area does not exist' });
    }

    const { value: area, error } = areaSchema.validate(body);
    if (error) {
        return response(status.BAD_REQUEST, {
            error: error.details.map((detail) => detail.message).join('; ')
        });
    }

    await dynamo.putArea({ uuid, ...area });

    return response(status.OK);
}

async function deleteArea(dynamo, uuid) {
    const events = (await dynamo.scanEvents()).Items;
    const eventUUIDsToDelete = [];
    for (const event of events) {
        if (event.area === uuid) {
            eventUUIDsToDelete.push(event.uuid);
        }
    }

    if (eventUUIDsToDelete.length > 0) {
        await dynamo.deleteEvents(eventUUIDsToDelete);
    }

    await dynamo.deleteArea(uuid);

    return response(status.OK);
}
