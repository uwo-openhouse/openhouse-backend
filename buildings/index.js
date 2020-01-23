const {
    AWS_REGION,
    TABLE_NAME
} = process.env;

const aws = require('aws-sdk');
aws.config.update({ region: AWS_REGION });
const ddb = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

// Use dependency injection to allow for easier unit testing
module.exports.handler = require('./handler.js')({
    dynamo: {
        scan: () => ddb.scan({ TableName: TABLE_NAME }).promise(),
        put: (item) => ddb.put({ TableName: TABLE_NAME, Item: item }).promise(),
        get: (uuid) => ddb.get({ TableName: TABLE_NAME, Key: { uuid }}).promise(),
        delete: (uuid) => ddb.delete({ TableName: TABLE_NAME, Key: { uuid }}).promise()
    }
});
