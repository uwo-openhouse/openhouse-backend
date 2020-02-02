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

const openHouseSchema = Joi.object({
    name: Joi.string().required(),
    date: Joi.number().integer().positive().required(),
    info: Joi.string().required(),
    visible: Joi.boolean().required()
});

module.exports = (deps) => async (event) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getOpenHouses(deps.dynamo);

            case 'POST':
                return createOpenHouse(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateOpenHouse(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' })
                }
                return deleteOpenHouse(deps.dynamo, event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getOpenHouses(dynamo) {
    try {
        const data = await dynamo.scanOpenHouses();

        for (const openHouse of data.Items) {
            openHouse.attendees = (await dynamo.getOpenHouseAttendees(openHouse.uuid)).Item.attendees;
        }

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createOpenHouse(dynamo, body) {
    try {
        const bodyOpenHouses = [];

        if (Array.isArray(body)) {
            bodyOpenHouses.push(...body);
        } else {
            bodyOpenHouses.push(body);
        }

        const validOpenHouses = [];
        for (let i = 0; i < bodyOpenHouses.length; i++) {
            const { value: openHouse, error } = openHouseSchema.validate(bodyOpenHouses[i]);

            if (error) {
                return response(status.BAD_REQUEST, {
                    error: error.details.map((error) => error.message).join('; ') + ` for open house with index ${i}`
                });
            } else {
                validOpenHouses.push(openHouse);
            }
        }

        const newOpenHouses = [];
        for (const openHouse of validOpenHouses) {
            const uuid = UUIDv4();

            const newOpenHouse = {
                uuid,
                ...openHouse
            };
            const newAttendees = {
                uuid,
                attendees: 0
            };

            await dynamo.putOpenHouse(newOpenHouse);
            await dynamo.putOpenHouseAttendees(newAttendees);

            newOpenHouses.push({
                ...newOpenHouse,
                ...newAttendees
            });
        }

        return response(status.CREATED, Array.isArray(body) ? newOpenHouses : newOpenHouses[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateOpenHouse(dynamo, uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await dynamo.getOpenHouse(uuid);
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Open House does not exist' });
        }

        const { value: openHouse, error } = openHouseSchema.validate(body);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((detail) => detail.message).join('; ')
            });
        }

        await dynamo.putOpenHouse({ uuid, ...openHouse });

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteOpenHouse(dynamo, uuid) {
    try {
        await dynamo.deleteOpenHouse(uuid);
        await dynamo.deleteOpenHouseAttendees(uuid);

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}
