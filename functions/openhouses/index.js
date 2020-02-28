const {
    AWS_REGION,
    OPEN_HOUSES_TABLE,
    OPEN_HOUSE_ATTENDEES_TABLE,
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
const BATCH_READ_MAX = 100;

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scanOpenHouses: () => ddb.scan({ TableName: OPEN_HOUSES_TABLE }).promise(),
        createOpenHouses: (openHouses) => {
            const writePromises = [];

            for (let i = 0; i < openHouses.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [OPEN_HOUSES_TABLE]: openHouses.slice(i, i + BATCH_WRITE_MAX).map((openHouse) => ({
                            PutRequest: {
                                Item: openHouse
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        putOpenHouse: (item) => ddb.put({ TableName: OPEN_HOUSES_TABLE, Item: item }).promise(),
        getOpenHouse: (uuid) => ddb.get({ TableName: OPEN_HOUSES_TABLE, Key: { uuid }}).promise(),
        deleteOpenHouse: (uuid) => ddb.delete({ TableName: OPEN_HOUSES_TABLE, Key: { uuid }}).promise(),

        createOpenHouseAttendees: (openHouseAttendees) => {
            const writePromises = [];

            for (let i = 0; i < openHouseAttendees.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [OPEN_HOUSE_ATTENDEES_TABLE]: openHouseAttendees.slice(i, i + BATCH_WRITE_MAX).map((openHouseAttendee) => ({
                            PutRequest: {
                                Item: openHouseAttendee
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        getOpenHouseAttendees: async (uuids) => {
            const getPromises = [];

            for (let i = 0; i < uuids.length; i += BATCH_READ_MAX) {
                getPromises.push(ddb.batchGet({
                    RequestItems: {
                        [OPEN_HOUSE_ATTENDEES_TABLE]: {
                            Keys: uuids.slice(i, i + BATCH_READ_MAX).map((uuid) => ({ uuid }))
                        }
                    }
                }).promise());
            }

            return (await Promise.all(getPromises)).map((result) => result.Responses[OPEN_HOUSE_ATTENDEES_TABLE]).flat();
        },
        putOpenHouseAttendees: (item) => ddb.put({ TableName: OPEN_HOUSE_ATTENDEES_TABLE, Item: item }).promise(),
        deleteOpenHouseAttendees: (uuid) => ddb.delete({ TableName: OPEN_HOUSE_ATTENDEES_TABLE, Key: { uuid }}).promise(),

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
