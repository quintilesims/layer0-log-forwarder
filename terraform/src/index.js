'use strict';

const Layer0Cache = require('./layer0-cache').Layer0Cache;
const zlib = require('zlib');
const aws = require('aws-sdk');
const ecs = new aws.ECS();
const kinesis = new aws.Kinesis({
    accessKeyId: process.env.STREAM_AWS_ACCESS_KEY,
    secretAccessKey: process.env.STREAM_AWS_SECRET_KEY,
    region: process.env.STREAM_AWS_REGION
});

const l0Cache = new Layer0Cache(ecs);

exports.handler = function(event, context, callback) {
    let instanceName;
    let containerName;
    let taskGuid;
    let eventPayload;

    parseEventData(event)
        .then(result => {
            eventPayload = result;

            if (eventPayload.messageType !== "DATA_MESSAGE") {
                throw "invalid message type: " + eventPayload.messageType;
            }

            instanceName = parseInstanceName(eventPayload.logGroup);
            containerName = parseContainerName(eventPayload.logStream);
            taskGuid = parseTaskGuid(eventPayload.logStream);

            return l0Cache.getTaskMetadata(taskGuid);
        })
        .then(metadata => {
            const serviceId = metadata ? metadata.serviceId : '<unkonwn>';
            const environmentId = metadata ? metadata.environmentId : '<unkonwn>';

            const writeToStreams = eventPayload.logEvents.map(e => {
                const data = {
                    event: {
                        Message: e.message,
                        Severity: extractSeverity(e.message),
                        LogGroupName: eventPayload.logGroup,
                        LogStreamName: eventPayload.logStream,
                        TaskGuid: taskGuid,
                        Layer0: {
                            ContainerName: containerName,
                            ServiceId: serviceId,
                            EnvironmentId: environmentId,
                            Instance: instanceName
                        }
                    },
                    source: environmentId + ':' + serviceId,
                    sourcetype: "layer0_service",
                    host: 'layer0',
                    time: e.timestamp
                };

                return writeToStream(JSON.stringify(data));
            });

            return Promise.all(writeToStreams);
        })
        .then(() => {
            callback(null, 'forwarding logs to stream complete');
        })
        .catch(err => {
            console.log(err);
            callback(err);
        });
  };

function writeToStream(data) {
    const params = {
        Data: data,
        PartitionKey: getRandomInt(32).toString(),
        StreamName: process.env.KINESIS_STREAM_NAME
    };

    return kinesis.putRecord(params).promise()
        .then(() => { })
        .catch(err => {
            console.log(err);
        });
}

function parseEventData(event) {
    return new Promise((resolve, reject) => {
        const payload = new Buffer(event.awslogs.data, 'base64');
        zlib.gunzip(payload, function (error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(JSON.parse(result.toString('utf8')));
            }
        });
    });
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

// extract instance name from the log group name
function parseInstanceName(logGroupName) {
    // log group name = l0-<instance_name>
    let instanceName = 'unknown';
    const logNameParts = logGroupName.split('-');

    if (logNameParts.length == 2) {
        instanceName = logNameParts[1];
    }

    return instanceName;
}

// extract container name from stream name
function parseContainerName(logStreamName) {
    //streamName = l0-<instance_name>/l0/<env_name>/<task_guid>
    let containerName = 'unknown';
    const streamNameParts = logStreamName.split('/');

    if (streamNameParts.length == 3) {
        containerName = streamNameParts[1];
    }

    return containerName;
}

// extract task guid stream name
function parseTaskGuid(logStreamName) {
    //streamName = l0/<env_name>/<task_guid>
    let taskGuid = 'unknown';
    const streamNameParts = logStreamName.split('/');

    if (streamNameParts.length == 3) {
        taskGuid = streamNameParts[2];
    }

    return taskGuid;
}

// attempt to determine the severity based on the content
function extractSeverity(logText) {
    let severity = 'Unknown';
    const text = logText.toLowerCase();

    if (text.indexOf('info') >= 0) {
        severity = 'Information';
    } else if (text.indexOf('debug') >= 0) {
        severity = 'Debug';
    } else if (text.indexOf('warn') >= 0) {
        severity = 'Warning';
    } else if (text.indexOf('err') >= 0) {
        severity = 'Error';
    } else if (text.indexOf('fatal') >= 0) {
        severity = 'Fatal';
    }

    return severity;
}
