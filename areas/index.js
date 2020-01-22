const aws = require('aws-sdk');
aws.config.update({ region: 'us-east-2' });

const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const TABLE_NAME = process.env.TABLE_NAME;

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scan: () => ddb.scan({ TableName: TABLE_NAME }).promise(),
        put: (item) => ddb.put({ TableName: TABLE_NAME, Item: item }).promise(),
        get: (uuid) => ddb.get({ TableName: TABLE_NAME, Key: { uuid }}).promise(),
        delete: (uuid) => ddb.delete({ TableName: TABLE_NAME, Key: { uuid }}).promise()
    }
});
