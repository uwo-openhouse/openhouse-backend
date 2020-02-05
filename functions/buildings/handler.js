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

const buildingSchema = Joi.object({
    name: Joi.string().required(),
    position: Joi.object({
        lat: Joi.number().greater(-90).less(90).required(),
        lng: Joi.number().greater(-180).less(180).required()
    }).required()
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return await getBuildings(deps.dynamo);

            case 'POST':
                return await createBuilding(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await updateBuilding(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await deleteBuilding(deps.dynamo, event.pathParameters.uuid);

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

async function getBuildings(dynamo) {
    const data = await dynamo.scanBuildings();

    return response(status.OK, data.Items);
}

async function createBuilding(dynamo, body) {
    const bodyBuildings = [];

    if (Array.isArray(body)) {
        bodyBuildings.push(...body);
    } else {
        bodyBuildings.push(body);
    }

    const validBuildings = [];
    for (let i = 0; i < bodyBuildings.length; i++) {
        const { value: building, error } = buildingSchema.validate(bodyBuildings[i]);

        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((error) => error.message).join('; ') + ` for building with index ${i}`
            });
        } else {
            validBuildings.push(building);
        }
    }

    const createdBuildings = [];
    for (const building of validBuildings) {
        createdBuildings.push({
            uuid: UUIDv4(),
            ...building
        });
    }
    await dynamo.createBuildings(createdBuildings);

    return response(status.CREATED, Array.isArray(body) ? createdBuildings : createdBuildings[0]);
}

async function updateBuilding(dynamo, uuid, body) {
    // Check to ensure uuid exists first
    const existingData = await dynamo.getBuilding(uuid);
    if (!existingData.Item) {
        return response(status.NOT_FOUND, { error: 'Building does not exist' });
    }

    const { value: building, error } = buildingSchema.validate(body);
    if (error) {
        return response(status.BAD_REQUEST, {
            error: error.details.map((detail) => detail.message).join('; ')
        });
    }

    await dynamo.putBuilding({ uuid, ...building });

    return response(status.OK);
}

async function deleteBuilding(dynamo, uuid) {
    await dynamo.deleteBuilding(uuid);

    return response(status.OK);
}
