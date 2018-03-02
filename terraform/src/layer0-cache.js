'use strict';

class Layer0Cache {
    constructor(ecs) {
        this.taskGuidMap = [];
        this.ecs = ecs;
    }

    getTaskMetadata(taskGuid) {
        return new Promise((resolve, reject) => {
            if (!this.taskGuidMap[taskGuid]) {
                this.buildTaskEnvironmentMap()
                    .then(() => {
                        resolve(this.taskGuidMap[taskGuid]);
                    });
            } else {
                resolve(this.taskGuidMap[taskGuid]);
            }
        });
    }

    buildTaskEnvironmentMap() {
        let promise = this.listClusters().then(clusterArns => {
            var serviceArnPromises = clusterArns.map(clusterArn => {
                return this.listServices(clusterArn);
            });

            return Promise.all(serviceArnPromises);
        })
            .then(clusterServiceMap => {
                var serviceDescribePromises = [];

                for (var i = 0; i < clusterServiceMap.length; i++) {
                    let clusterArn = clusterServiceMap[i].clusterArn;
                    let serviceArns = clusterServiceMap[i].serviceArns;

                    if (serviceArns.length == 0) {
                        continue;
                    }

                    // can describe a maximum of 10 services per call
                    for (var j = 0; j < serviceArns.length; j = j + 10) {
                        let p = this.describeServices(clusterArn, serviceArns.slice(j, j + 10));
                        serviceDescribePromises.push(p);
                    }
                }

                return Promise.all(serviceDescribePromises);
            })
            .then(servicesArrays => {
                var services = [];
                servicesArrays.map(arr => services = services.concat(arr));

                return services.map(s => {
                    return { serviceName: s.serviceName, clusterArn: s.clusterArn }
                });
            })
            .then(clusterServices => {
                var taskListPromises = clusterServices.map(c => {
                    return this.listTasks(c.clusterArn, c.serviceName);
                });

                return Promise.all(taskListPromises);
            })
            .then(clusterServiceTaskArns => {
                //build task to env, service map
                var taskGuidMap = [];
                clusterServiceTaskArns.map(c => {
                    for (var i = 0; i < c.taskArns.length; i++) {
                        let key = this.taskArnToTaskGuid(c.taskArns[i]);
                        let value = {
                            environmentId: this.clusterArnToEnvId(c.clusterArn),
                            serviceId: this.serviceNameToServiceId(c.serviceName)
                        };

                        taskGuidMap[key] = value;
                    }
                });

                this.taskGuidMap = taskGuidMap;
            })
            .catch(err => {
                console.log(err);
            });

        return promise;
    }

    listClusters(nextToken = '', clusterArns = []) {
        let params = {
            nextToken: nextToken
        };

        return this.ecs.listClusters(params).promise()
            .then(result => {
                clusterArns = result.clusterArns.concat(clusterArns);
                if (result.nextToken) {
                    return listClusters(result.nextToken, clusterArns);
                }

                return clusterArns;
            })
            .catch(err => {
                console.log(err);
            });
    }

    listServices(clusterArn, nextToken = '', serviceArns = []) {
        let params = {
            cluster: clusterArn,
            nextToken: nextToken
        };

        return this.ecs.listServices(params).promise()
            .then(result => {
                serviceArns = result.serviceArns.concat(serviceArns);
                if (result.nextToken) {
                    return listServices(clusterArn, result.nextToken, serviceArns);
                }

                return { clusterArn: clusterArn, serviceArns: serviceArns };
            })
            .catch(err => {
                console.log(err);
            });
    }

    describeServices(clusterArn, serviceArns) {
        let params = {
            cluster: clusterArn,
            services: serviceArns
        };

        return this.ecs.describeServices(params).promise()
            .then(result => {
                return result.services;
            })
            .catch(err => {
                console.log(err);
            });
    }

    listTasks(clusterArn, serviceName, nextToken = '', taskArns = []) {
        let params = {
            cluster: clusterArn,
            serviceName: serviceName,
            nextToken: nextToken
        };

        return this.ecs.listTasks(params).promise()
            .then(result => {
                taskArns = result.taskArns.concat(taskArns);
                if (result.nextToken) {
                    return listTasks(clusterArn, serviceName, result.nextToken, taskArns);
                }

                return {
                    clusterArn: clusterArn,
                    serviceName: serviceName,
                    taskArns: taskArns
                }
            })
            .catch(err => {
                console.log(err);
            });
    }

    clusterArnToEnvId(clusterArn) {
        return clusterArn.split('/')[1].split('-')[2];
    }

    serviceNameToServiceId(serviceName) {
        return serviceName.split('-')[2];
    }

    taskArnToTaskGuid(taskArn) {
        return taskArn.split('/')[1];
    }

}

exports.Layer0Cache = Layer0Cache;