const {
    AWS_REGION,
    EVENTS_TABLE,
    EVENT_ATTENDEES_TABLE,
    BUILDINGS_TABLE,
    AREAS_TABLE,
    OPEN_HOUSES_TABLE,
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
        scanEvents: () => ddb.scan({ TableName: EVENTS_TABLE }).promise(),
        createEvents: (events) => {
            const writePromises = [];

            for (let i = 0; i < events.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [EVENTS_TABLE]: events.slice(i, i + BATCH_WRITE_MAX).map((event) => ({
                            PutRequest: {
                                Item: event
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        getEvent: (uuid) => ddb.get({ TableName: EVENTS_TABLE, Key: { uuid }}).promise(),
        putEvent: (item) => ddb.put({ TableName: EVENTS_TABLE, Item: item }).promise(),
        deleteEvent: (uuid) => ddb.delete({ TableName: EVENTS_TABLE, Key: { uuid }}).promise(),

        createEventAttendees: (eventAttendees) => {
            const writePromises = [];

            for (let i = 0; i < eventAttendees.length; i += BATCH_WRITE_MAX) {
                writePromises.push(ddb.batchWrite({
                    RequestItems: {
                        [EVENT_ATTENDEES_TABLE]: eventAttendees.slice(i, i + BATCH_WRITE_MAX).map((eventAttendee) => ({
                            PutRequest: {
                                Item: eventAttendee
                            }
                        }))
                    }
                }).promise());
            }

            return Promise.all(writePromises);
        },
        getEventAttendees: async (uuids) => (await ddb.batchGet({
            RequestItems: {
                [EVENT_ATTENDEES_TABLE]: {
                    Keys: uuids.map((uuid) => ({ uuid }))
                }
            }
        }).promise()).Responses[EVENT_ATTENDEES_TABLE],
        putEventAttendees: (item) => ddb.put({ TableName: EVENT_ATTENDEES_TABLE, Item: item }).promise(),
        deleteEventAttendees: (uuid) => ddb.delete({ TableName: EVENT_ATTENDEES_TABLE, Key: { uuid }}).promise(),

        buildingExists: async (uuid) =>
            Boolean((await ddb.get({ TableName: BUILDINGS_TABLE, Key: { uuid }}).promise()).Item),
        areaExists: async (uuid) =>
            Boolean((await ddb.get({ TableName: AREAS_TABLE, Key: { uuid }}).promise()).Item),
        openHouseExists: async (uuid) =>
            Boolean((await ddb.get({ TableName: OPEN_HOUSES_TABLE, Key: { uuid }}).promise()).Item)
    }
});
