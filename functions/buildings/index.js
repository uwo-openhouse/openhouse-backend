const {
    AWS_REGION,
    BUILDINGS_TABLE,
    EVENTS_TABLE,
    EATERIES_TABLE,
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
        scanBuildings: () => ddb.scan({ TableName: BUILDINGS_TABLE }).promise(),
        createBuildings: (buildings) => {
            const writePromises = [];

            for (let i = 0; i < buildings.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [BUILDINGS_TABLE]: buildings.slice(i, i + BATCH_WRITE_MAX).map((building) => ({
                            PutRequest: {
                                Item: building
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        putBuilding: (item) => ddb.put({ TableName: BUILDINGS_TABLE, Item: item }).promise(),
        getBuilding: (uuid) => ddb.get({ TableName: BUILDINGS_TABLE, Key: { uuid }}).promise(),
        deleteBuilding: (uuid) => ddb.delete({ TableName: BUILDINGS_TABLE, Key: { uuid }}).promise(),

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

        scanEateries: () => ddb.scan({ TableName: EATERIES_TABLE }).promise(),
        deleteEateries: (uuids) => {
            const writePromises = [];

            for (let i = 0; i < uuids.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [EATERIES_TABLE]: uuids.slice(i, i + BATCH_WRITE_MAX).map((uuid) => ({
                            DeleteRequest: { Key: { uuid } }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
    }
});
