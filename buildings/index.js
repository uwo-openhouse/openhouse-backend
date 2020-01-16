const aws = require('aws-sdk');
const status = require('http-status');
const UUIDv4 = require('uuid/v4');
const Joi = require('@hapi/joi');

aws.config.update({ region: 'us-east-2' });
const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const TABLE_NAME = process.env.TABLE_NAME;

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
                    return {
                        statusCode: status.BAD_REQUEST,
                        body: JSON.stringify({
                            error: 'Missing UUID in URL path'
                        })
                    }
                }
                return updateBuilding(event.pathParameters.uuid, JSON.parse(event.body));

            case 'DELETE':
                if (!event.pathParameters || !event.pathParameters.uuid) {
                    return {
                        statusCode: status.BAD_REQUEST,
                        body: JSON.stringify({
                            error: 'Missing UUID in URL path'
                        })
                    }
                }
                return deleteBuilding(event.pathParameters.uuid);

            default:
                return { statusCode: status.METHOD_NOT_ALLOWED };
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

async function getBuildings() {
    try {
        const data = await ddb.scan({ TableName: TABLE_NAME }).promise();

        return {
            statusCode: status.OK,
            body: JSON.stringify(data.Items)
        };
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
                return {
                    statusCode: status.BAD_REQUEST,
                    body: JSON.stringify({
                        error: error.details.map((error) => error.message).join('; ') + ` for building with index ${i}`
                    })
                }
            } else {
                validBuildings.push(building);
            }
        }

        for (const building of validBuildings) {
            await ddb.put({
                TableName: TABLE_NAME,
                Item: {
                    uuid: UUIDv4(),
                    ...building
                }
            }).promise();
        }

        return { statusCode: status.CREATED };
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
            return {
                statusCode: status.NOT_FOUND,
                body: JSON.stringify({
                    error: 'Building does not exist'
                })
            }
        }

        const { value: building, error } = buildingSchema.validate(body);
        if (error) {
            return {
                statusCode: status.BAD_REQUEST,
                body: JSON.stringify({
                    error: error.details.map((detail) => detail.message).join('; ')
                })
            }
        }

        // Save new building item
        await ddb.put({
            TableName: TABLE_NAME,
            Item: {
                uuid,
                ...building
            }
        }).promise();

        return { statusCode: status.OK };
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

        return { statusCode: status.OK };
    } catch (err) {
        console.error(err);
        return err;
    }
}
