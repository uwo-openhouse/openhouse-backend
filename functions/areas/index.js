const {
    AWS_REGION,
    AREAS_TABLE,
    EVENTS_TABLE,
    ENDPOINT_OVERRIDE
} = process.env;

const aws = require('aws-sdk');
aws.config.update({ region: AWS_REGION });

let ddb;
if (ENDPOINT_OVERRIDE) {
    ddb = new aws.DynamoDB.DocumentClient({
        endpoint: ENDPOINT_OVERRIDE,
        apiVersion: '2012-08-10',
        maxRetries: 1
    });
} else {
    ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
}

const BATCH_WRITE_MAX = 25;

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scanAreas: () => ddb.scan({ TableName: AREAS_TABLE }).promise(),
        createAreas: (areas) => {
            const writePromises = [];

            for (let i = 0; i < areas.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [AREAS_TABLE]: areas.slice(i, i + BATCH_WRITE_MAX).map((area) => ({
                            PutRequest: {
                                Item: area
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        putArea: (item) => ddb.put({ TableName: AREAS_TABLE, Item: item }).promise(),
        getArea: (uuid) => ddb.get({ TableName: AREAS_TABLE, Key: { uuid }}).promise(),
        deleteArea: (uuid) => ddb.delete({ TableName: AREAS_TABLE, Key: { uuid }}).promise(),

        scanEvents: () => ddb.scan({ TableName: EVENTS_TABLE }).promise(),
        deleteEvents: (uuids) => {
            const writePromises = [];

            for (let i = 0; i < uuids.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [EVENTS_TABLE]: uuids.slice(i, i + BATCH_WRITE_MAX).map((uuid) => ({
                            DeleteRequest: { Key: { uuid } }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
    }
});
