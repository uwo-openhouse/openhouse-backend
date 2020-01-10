const status = require('http-status');

exports.handler = async (event, context) => {
    try {
        switch (event.httpMethod) {
            case 'GET':
                return getDepartments();
            case 'POST':
                return createDepartment(event.body);
            case 'PUT':
                return updateDepartment(event.body);
            case 'DELETE':
                return deleteDepartment();
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

async function getDepartments() {
    // TODO
    return toBeReplaced;
}

async function createDepartment(body) {
    // TODO
    return toBeReplaced;
}

async function updateDepartment(body) {
    // TODO
    return toBeReplaced;
}

async function deleteDepartment(body) {
    // TODO
    return toBeReplaced;
}
