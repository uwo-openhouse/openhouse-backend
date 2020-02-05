const {
    AWS_REGION,
    OPEN_HOUSES_TABLE,
    OPEN_HOUSE_ATTENDEES_TABLE,
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

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scanOpenHouses: () => ddb.scan({ TableName: OPEN_HOUSES_TABLE }).promise(),
        createOpenHouses: (openHouses) => ddb.batchWrite({
            RequestItems: {
                [OPEN_HOUSES_TABLE]: openHouses.map((openHouse) => ({
                    PutRequest: {
                        Item: openHouse
                    }
                }))
            }
        }).promise(),
        putOpenHouse: (item) => ddb.put({ TableName: OPEN_HOUSES_TABLE, Item: item }).promise(),
        getOpenHouse: (uuid) => ddb.get({ TableName: OPEN_HOUSES_TABLE, Key: { uuid }}).promise(),
        deleteOpenHouse: (uuid) => ddb.delete({ TableName: OPEN_HOUSES_TABLE, Key: { uuid }}).promise(),

        createOpenHouseAttendees: (openHouseAttendees) => ddb.batchWrite({
            RequestItems: {
                [OPEN_HOUSE_ATTENDEES_TABLE]: openHouseAttendees.map((openHouseAttendee) => ({
                    PutRequest: {
                        Item: openHouseAttendee
                    }
                }))
            }
        }).promise(),
        getOpenHouseAttendees: async (uuids) => (await ddb.batchGet({
            RequestItems: {
                [OPEN_HOUSE_ATTENDEES_TABLE]: {
                    Keys: uuids.map((uuid) => ({ uuid }))
                }
            }
        }).promise()).Responses[OPEN_HOUSE_ATTENDEES_TABLE],
        putOpenHouseAttendees: (item) => ddb.put({ TableName: OPEN_HOUSE_ATTENDEES_TABLE, Item: item }).promise(),
        deleteOpenHouseAttendees: (uuid) => ddb.delete({ TableName: OPEN_HOUSE_ATTENDEES_TABLE, Key: { uuid }}).promise(),
    }
});
