const aws = require('aws-sdk');
const status = require('http-status');
const UUIDv4 = require('uuid/v4');
const Joi = require('@hapi/joi');

aws.config.update({ region: 'us-east-2' });
const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const TABLE_NAME = process.env.TABLE_NAME;

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

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getOpenHouses();

            case 'POST':
                return createOpenHouse(JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateOpenHouse(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' })
                }
                return deleteOpenHouse(event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getOpenHouses() {
    try {
        const data = await ddb.scan({ TableName: TABLE_NAME }).promise();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createOpenHouse(body) {
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
            const newOpenHouse = {
                uuid: UUIDv4(),
                ...openHouse
            };

            await ddb.put({
                TableName: TABLE_NAME,
                Item: newOpenHouse
            }).promise();

            newOpenHouses.push(newOpenHouse);
        }

        return response(status.CREATED, Array.isArray(body) ? newOpenHouses : newOpenHouses[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateOpenHouse(uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await ddb.get({
            TableName: TABLE_NAME,
            Key: { uuid }
        }).promise();
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Open House does not exist' });
        }

        const { value: openHouse, error } = openHouseSchema.validate(body);
        if (error) {
            return response(status.BAD_REQUEST, {
                error: error.details.map((detail) => detail.message).join('; ')
            });
        }

        // Save new building item
        await ddb.put({
            TableName: TABLE_NAME,
            Item: {
                uuid,
                ...openHouse
            }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteOpenHouse(uuid) {
    try {
        await ddb.delete({
            TableName: TABLE_NAME,
            Key: { uuid }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}
