const pino = require('pino');
const {lambdaRequestTracker, pinoLambdaDestination} = require('pino-lambda');

const destination = pinoLambdaDestination();
const logger = pino({
    base: undefined,
    formatters: {
        level: (label) => {
            return {
                level: label.toUpperCase()
            }
        }
    },
}, destination);
const withRequest = lambdaRequestTracker();

module.exports = {
    logger,
    withRequest
}
