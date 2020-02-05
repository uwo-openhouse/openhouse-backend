const {
    TABLE_NAME,
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
        scanAreas: () => ddb.scan({ TableName: TABLE_NAME }).promise(),
        createAreas: (areas) => ddb.batchWrite({
            RequestItems: {
                [TABLE_NAME]: areas.map((area) => ({
                    PutRequest: {
                        Item: area
                    }
                }))
            }
        }).promise(),
        putArea: (item) => ddb.put({ TableName: TABLE_NAME, Item: item }).promise(),
        getArea: (uuid) => ddb.get({ TableName: TABLE_NAME, Key: { uuid }}).promise(),
        deleteArea: (uuid) => ddb.delete({ TableName: TABLE_NAME, Key: { uuid }}).promise()
    }
});
