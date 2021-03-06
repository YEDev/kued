'use strict';

const Joi = require('joi');

const RedisUriSchema = Joi.string().uri({ scheme: 'redis' });

const RedisTCPSchema = Joi.object().keys({
  port: Joi.number().integer().min(1).max(65535),
  host: Joi.alternatives().try(
    Joi.string().hostname(),
    Joi.string().ip()
  ),
  auth: Joi.string().min(1),
  db: Joi.number().integer().min(0),
  options: Joi.object()
});

const RedisUNIXSchema = Joi.object().keys({
  socket: Joi.string().required(),
  auth: Joi.string().min(1),
  options: Joi.object()
});

const RedisFactorySchema = Joi.object().keys({
  createClientFactory: Joi.func()
});

const RedisSchema = Joi.alternatives().try(
  RedisUriSchema,
  RedisTCPSchema,
  RedisUNIXSchema,
  RedisFactorySchema
);

module.exports = RedisSchema;