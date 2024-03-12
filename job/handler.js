const AWS = require('aws-sdk');
const {logger} = require("./config/logger");

AWS.config.update({region: 'us-east-1'});
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

const updateCDIDaily  = async () => {
    let params = {
        DelaySeconds: 10,
        MessageBody: 'daily-cdi-update',
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/669204338030/saveDailyCDIQueue_DEV"
    };
    try {
        await sqs.sendMessage(params).promise();
    } catch (e) {
        logger.error({error: e.message}, `Error sending message`);
    }
}

const run = async () => {
    await updateCDIDaily ()
};

module.exports = {
    run
}
