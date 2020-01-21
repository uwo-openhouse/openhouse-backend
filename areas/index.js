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

const areaSchema = Joi.object({
    name: Joi.string().required(),
    color: Joi.string().regex(new RegExp('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'), { name: 'Hex Color Code' }).required()
});

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getAreas();

            case 'POST':
                return createArea(JSON.parse(event.body));

            case 'PUT':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return updateArea(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return response(status.BAD_REQUEST, { error: 'Missing UUID in URL path' });
                }
                return deleteArea(event.pathParameters.uuid);

            default:
                return response(status.METHOD_NOT_ALLOWED);
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getAreas() {
    try {
        const data = await ddb.scan({ TableName: TABLE_NAME }).promise();

        return response(status.OK, data.Items);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function createArea(body) {
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

        const newAreas = [];
        for (const area of validAreas) {
            const newArea = {
                uuid: UUIDv4(),
                ...area
            };

            await ddb.put({
                TableName: TABLE_NAME,
                Item: newArea
            }).promise();

            newAreas.push(newArea);
        }

        return response(status.CREATED, Array.isArray(body) ? newAreas : newAreas[0]);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function updateArea(uuid, body) {
    try {
        // Check to ensure uuid exists first
        const existingData = await ddb.get({
            TableName: TABLE_NAME,
            Key: { uuid }
        }).promise();
        if (!existingData.Item) {
            return response(status.NOT_FOUND, { error: 'Area does not exist' });
        }

        const { value: area, error } = areaSchema.validate(body);
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
                ...area
            }
        }).promise();

        return response(status.OK);
    } catch (err) {
        console.error(err);
        return err;
    }
}

async function deleteArea(uuid) {
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
