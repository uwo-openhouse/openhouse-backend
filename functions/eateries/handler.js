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

const eaterySchema = Joi.object({
    name: Joi.string().required(),
    openTime: Joi.string().pattern(new RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$'), { name: 'HH:mm' }).required(),
    closeTime: Joi.string().pattern(new RegExp('^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$'), { name: 'HH:mm' }).required(),
    building: Joi.string().uuid().required(),
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getEateries(deps.dynamo);

            case 'POST':
                return createEatery(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateEatery(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteEatery(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getEateries(dynamo) {
    try {
        const data = await dynamo.scanEateries();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createEatery(dynamo, body) {
    try {
        const bodyEateries = [];

        if (Array.isArray(body)) {
            bodyEateries.push(...body);
        } else {
            bodyEateries.push(body);
        }

        const validEateries = [];
        for (let i = 0; i < bodyEateries.length; i++) {
            const { value: eatery, error } = eaterySchema.validate(bodyEateries[i]);
            if (error) {
                return response(status.BAD_REQUEST, {
                    error: error.details.map((error) => error.message).join('; ') + ` for eatery with index ${i}`
                });
            }

            if (!await buildingExists(dynamo, eatery.building)) {
                return response(status.BAD_REQUEST, { error: `Specified building does not exist for eatery with index ${i}` });
            }

            validEateries.push(eatery);
        }

        const createdEateries = [];
        for (const eatery of validEateries) {
            const newEatery = {
                uuid: UUIDv4(),
                ...eatery
            };

            await dynamo.putEatery(newEatery);
            createdEateries.push(newEatery);
        }

        return response(status.CREATED, Array.isArray(body) ? createdEateries : createdEateries[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateEatery(dynamo, uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await dynamo.getEatery(uuid);
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Eatery does not exist' });
        }

        const { value: eatery, error } = eaterySchema.validate(body);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((detail) => detail.message).join('; ')
            });
        }

        if (!await buildingExists(dynamo, eatery.building)) {
            return response(status.BAD_REQUEST, { error: 'Specified building does not exist' });
        }

        await dynamo.putEatery({ uuid, ...eatery });

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteEatery(dynamo, uuid) {
    try {
        await dynamo.deleteEatery(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function buildingExists(dynamo, uuid) {
    return Boolean((await dynamo.getBuilding(uuid)).Item);
}
