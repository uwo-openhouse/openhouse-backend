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
        getAttendees: (uuid) => ddb.get({ TableName: TABLE_NAME, Key: { uuid }}).promise(),
        incrementAttendees: (uuid) => ddb.update({
            TableName: TABLE_NAME,
            Key: { uuid },
            UpdateExpression: 'SET attendees = attendees + :incr',
            ExpressionAttributeValues: { ':incr': 1 }
        }).promise(),
        decrementAttendees: (uuid) => ddb.update({
            TableName: TABLE_NAME,
            Key: { uuid },
            UpdateExpression: 'SET attendees = attendees - :decr',
            ConditionExpression: 'attendees > :min',
            ExpressionAttributeValues: { ':decr': 1, ':min': 0 },
        }).promise(),
    }
});
