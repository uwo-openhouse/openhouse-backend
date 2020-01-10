# openhouse-backend

This repository contains all the code for the serverless backend using a SAM template. It defines any additional 
infrastructure in the CloudFormation stack to support the project (e.g. databases).

## Initializing

### Local requirements:

- [Yarn](https://yarnpkg.com/en/docs/install)
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- [Docker](https://www.docker.com/products/docker-desktop)

```
$ sam build
```

## Running API Locally

Ensure the docker engine is running and run the following to start a local API server on `http://localhost:3000/`:

```
$ sam build
$ sam local start-api
```

## Deployment

To deploy the application, run the following (TODO: Assign this job to CI/CD system):

```
$ sam build
$ sam deploy --stack-name openhouse-backend --capabilities CAPABILITY_IAM --s3-bucket uwo-openhouse-backend-builds --region us-east-2 --confirm-changeset
```

## Running tests

```
$ cd buildings/
$ yarn test
```

