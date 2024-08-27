"use strict";
const Joi = require('joi');

module.exports = {
  endpoint: Joi.string().required(),
  token: Joi.string(),
  stages: Joi.array().items(Joi.string()).min(1).default(['PUBLISHED']),
  locales: Joi.array().items(Joi.string()).min(1).default(['en']),
  allowedTypes: Joi.array().items(Joi.string()).default(''),
  typePrefix: Joi.string().default(`Hygraph`),
  downloadAssets: Joi.boolean().default(false),
  downloadLocalImages: Joi.boolean().default(false),
  concurrency: Joi.number().integer().min(1).default(50),
  interval: Joi.number().min(300).default(1000),
  assetsDir: Joi.string().default('.assets'),
  fragmentsDir: Joi.string().default('.fragments'),
  buildMarkdownNodes: Joi.boolean().default(false),
  markdownFields: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())).default({}),
  cleanupRichText: Joi.boolean().default(true)
};