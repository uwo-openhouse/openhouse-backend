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
        scanOpenHouses: () => ddb.scan({ TableName: TABLE_NAME }).promise(),
        putOpenHouse: (item) => ddb.put({ TableName: TABLE_NAME, Item: item }).promise(),
        getOpenHouse: (uuid) => ddb.get({ TableName: TABLE_NAME, Key: { uuid }}).promise(),
        deleteOpenHouse: (uuid) => ddb.delete({ TableName: TABLE_NAME, Key: { uuid }}).promise()
    }
});
