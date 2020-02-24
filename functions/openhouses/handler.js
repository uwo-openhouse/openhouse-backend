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
                return await getOpenHouses(deps.dynamo);

            case 'POST':
                return await createOpenHouse(deps.dynamo, JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return await updateOpenHouse(deps.dynamo, event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' })
                }
                return await deleteOpenHouse(deps.dynamo, event.pathParameters.uuid);

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

async function getOpenHouses(dynamo) {
    const openHouses = (await dynamo.scanOpenHouses()).Items;

    if (openHouses.length > 0) {
        const openHouseAttendees = await dynamo.getOpenHouseAttendees(openHouses.map((event) => event.uuid));

        // Change array of openHouseAttendees objects to uuid => count map
        const attendeesMap = openHouseAttendees.reduce((map, openHouseAttendee) => {
            map[openHouseAttendee.uuid] = openHouseAttendee.attendees;
            return map;
        }, {});

        for (const openHouse of openHouses) {
            const attendees = attendeesMap[openHouse.uuid];
            if (attendees != null) {
                openHouse.attendees = attendees;
            }
        }
    }

    return response(status.OK, openHouses);
}

async function createOpenHouse(dynamo, body) {
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

    const createdOpenHouses = [];
    const createdOpenHouseAttendees = [];
    const resultOpenHouses = [];
    for (const openHouse of validOpenHouses) {
        const uuid = UUIDv4();

        createdOpenHouses.push({
            uuid,
            ...openHouse
        });
        createdOpenHouseAttendees.push({
            uuid,
            attendees: 0
        });
        resultOpenHouses.push({
            uuid,
            attendees: 0,
            ...openHouse
        });
    }

    await dynamo.createOpenHouses(createdOpenHouses);
    await dynamo.createOpenHouseAttendees(createdOpenHouseAttendees);

    return response(status.CREATED, Array.isArray(body) ? resultOpenHouses : resultOpenHouses[0]);
}

async function updateOpenHouse(dynamo, uuid, body) {
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
}

async function deleteOpenHouse(dynamo, uuid) {
    const events = (await dynamo.scanEvents()).Items;
    const eventUUIDsToDelete = [];
    for (const event of events) {
        if (event.openHouse === uuid) {
            eventUUIDsToDelete.push(event.uuid);
        }
    }

    if (eventUUIDsToDelete.length > 0) {
        await dynamo.deleteEvents(eventUUIDsToDelete);
    }

    await dynamo.deleteOpenHouse(uuid);
    await dynamo.deleteOpenHouseAttendees(uuid);

    return response(status.OK);
}
