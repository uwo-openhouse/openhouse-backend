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
                return getBuildings(deps.dynamo);

            case 'POST':
                return createBuilding(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateBuilding(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteBuilding(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getBuildings(dynamo) {
    try {
        const data = await dynamo.scan();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createBuilding(dynamo, body) {
    try {
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

        const newBuildings = [];
        for (const building of validBuildings) {
            const newBuilding = {
                uuid: UUIDv4(),
                ...building
            };

            await dynamo.put(newBuilding);
            newBuildings.push(newBuilding);
        }

        return response(status.CREATED, Array.isArray(body) ? newBuildings : newBuildings[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateBuilding(dynamo, uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await dynamo.get(uuid);
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Building does not exist' });
        }

        const { value: building, error } = buildingSchema.validate(body);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((detail) => detail.message).join('; ')
            });
        }

        // Save new building item
        await dynamo.put({ uuid, ...building });

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteBuilding(dynamo, uuid) {
    try {
        await dynamo.delete(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}
