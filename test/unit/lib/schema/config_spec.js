'use strict';

const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;

const Joi = require('joi');
const ConfigSchema = require('../../../../lib/schemas/config');

describe('Config Schema', function(){

  const expectToBeValid = function(config){
    const shouldBeValid = Joi.validate(config, ConfigSchema);
    expect(shouldBeValid.error).to.be.null;
  };

  it('should allow valid configuration', function(){

    expectToBeValid({
      "providers": [
        {
          "provides": "kue",
          "connection": {
            "prefix": "myservice",
              "redis": {
              "port": 6379,
                "host": "localhost",
                "auth": "alright_alright_alright"
            }
          }
        },
        {
          "provides": "imq",
          "token": "abcde12345",
          "project_id": "asdfadfadsf"
        },
        {
          "provides": "checkpointer",
          "name": "redis-checkpointer",
          "require": "kued/lib/checkpointers/redis"
        }
      ],
      "workers": [
        {
          "name": "MyWorker",
          "require": "./lib/workers/myworker",
          "options": {
            "mongo": "mongodb://blah"
          }
        },
        {
          "name": "YourWorker",
          "require": "./lib/workers/yourworker",
          "options": {
            "db": "mysql://blah"
          }
        }
      ],
      "bridges": [
        {
          "name": "GoldenGate",
          "input": "imq:queue",
          "output": "kue:task-worker-topic",
          "options": {}
        }
      ],
      "workgroups": [
        {
          "workers": ["MyWorker", "YourWorker"],
          "instances": 3
        },
        {
          "workers": ["GoldenGate"],
          "instances": 1
        }
      ]
    });

  });


});