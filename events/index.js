const {
    AWS_REGION,
    EVENTS_TABLE
} = process.env;

const aws = require('aws-sdk');
aws.config.update({ region: AWS_REGION });
const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scan: () => ddb.scan({ TableName: EVENTS_TABLE }).promise(),
        put: (item) => ddb.put({ TableName: EVENTS_TABLE, Item: item }).promise(),
        get: (table, uuid) => ddb.get({ TableName: table, Key: { uuid }}).promise(), // NOTE different than other lambdas
        delete: (uuid) => ddb.delete({ TableName: EVENTS_TABLE, Key: { uuid }}).promise()
    }
});
