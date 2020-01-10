const status = require('http-status');

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getBuildings();
            case 'POST':
                return createBuilding(event.body);
            case 'PUT':
                return updateBuilding(event.body);
            case 'DELETE':
                return deleteBuilding();
            default:
                return {
                    statusCode: status.METHOD_NOT_ALLOWED
                };
        }
    } catch (err) {
        console.err(err);
        return err;
    }
};

const toBeReplaced = {
    body: JSON.stringify({
        success: true
    }),
    statusCode: status.OK
};

async function getBuildings() {
    // TODO
    return toBeReplaced;
}

async function createBuilding(body) {
    // TODO
    return toBeReplaced;
}

async function updateBuilding(body) {
    // TODO
    return toBeReplaced;
}

async function deleteBuilding(body) {
    // TODO
    return toBeReplaced;
}



