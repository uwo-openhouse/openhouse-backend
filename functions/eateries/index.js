const {
    EATERIES_TABLE,
    BUILDINGS_TABLE,
    ENDPOINT_OVERRIDE
} = process.env;

const aws = require('aws-sdk');
aws.config.update({ region: 'us-east-2' });

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
        scanEateries: () => ddb.scan({ TableName: EATERIES_TABLE }).promise(),
        createEateries: (eateries) => ddb.batchWrite({
            RequestItems: {
                [EATERIES_TABLE]: eateries.map((eatery) => ({
                    PutRequest: {
                        Item: eatery
                    }
                }))
            }
        }).promise(),
        putEatery: (item) => ddb.put({ TableName: EATERIES_TABLE, Item: item }).promise(),
        getEatery: (uuid) => ddb.get({ TableName: EATERIES_TABLE, Key: { uuid }}).promise(),
        deleteEatery: (uuid) => ddb.delete({ TableName: EATERIES_TABLE, Key: { uuid }}).promise(),

        buildingExists: async (uuid) =>
            Boolean((await ddb.get({ TableName: BUILDINGS_TABLE, Key: { uuid }}).promise()).Item),
    }
});
