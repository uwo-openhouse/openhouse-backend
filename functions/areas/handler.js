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

const areaSchema = Joi.object({
    name: Joi.string().required(),
    color: Joi.string().regex(new RegExp('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'), { name: 'Hex Color Code' }).required()
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getAreas(deps.dynamo);

            case 'POST':
                return createArea(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateArea(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteArea(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getAreas(dynamo) {
    try {
        const data = await dynamo.scanAreas();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createArea(dynamo, body) {
    try {
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
            const newArea = {
                uuid: UUIDv4(),
                ...area
            };

            await dynamo.putArea(newArea);
            createdAreas.push(newArea);
        }

        return response(status.CREATED, Array.isArray(body) ? createdAreas : createdAreas[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateArea(dynamo, uuid, body) {
    try {
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
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteArea(dynamo, uuid) {
    try {
        await dynamo.deleteArea(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}
