/**
 * This script set ups a local dynamoDB tables to run the application locally.
 */

const tables = [{
    name: 'OpenHouse-Areas',
    key: 'uuid'
}, {
    name: 'OpenHouse-Buildings',
    key: 'uuid'
}, {
    name: 'OpenHouse-EventAttendees',
    key: 'uuid'
}, {
    name: 'OpenHouse-Events',
    key: 'uuid'
}, {
    name: 'OpenHouse-OpenHouses',
    key: 'uuid'
}, {
    name: 'OpenHouse-OpenHouseAttendees',
    key: 'uuid'
}];

const aws = require('aws-sdk');
aws.config.update({ region: 'us-east-2' });

(async function() {
    try {
        const dynamoDB = new aws.DynamoDB({
            endpoint: 'http://localhost:8000'
        });

        for (const table of tables) {
            const newTable = {
                TableName: table.name,
                AttributeDefinitions: [{
                    AttributeName: table.key,
                    AttributeType: 'S'
                }],
                KeySchema: [{
                    AttributeName: table.key,
                    KeyType: 'HASH'
                }],
                BillingMode: 'PAY_PER_REQUEST',
            };

            console.log(`Creating table with configuration:`);
            console.log(newTable);
            process.stdout.write("...");

            await dynamoDB.createTable(newTable).promise();

            console.log(' Done');
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
