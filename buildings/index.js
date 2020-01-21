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

const buildingSchema = Joi.object({
    name: Joi.string().required(),
    position: Joi.object({
        lat: Joi.number().greater(-90).less(90).required(),
        lng: Joi.number().greater(-180).less(180).required()
    }).required()
});

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getBuildings();

            case 'POST':
                return createBuilding(JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateBuilding(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteBuilding(event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getBuildings() {
    try {
        const data = await ddb.scan({ TableName: TABLE_NAME }).promise();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createBuilding(body) {
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

            await ddb.put({
                TableName: TABLE_NAME,
                Item: newBuilding
            }).promise();

            newBuildings.push(newBuilding);
        }

        return response(status.CREATED, Array.isArray(body) ? newBuildings : newBuildings[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateBuilding(uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await ddb.get({
            TableName: TABLE_NAME,
            Key: { uuid }
        }).promise();
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
        await ddb.put({
            TableName: TABLE_NAME,
            Item: {
                uuid,
                ...building
            }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteBuilding(uuid) {
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
