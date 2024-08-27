"use strict";
const toolkit = require('gatsby-graphql-source-toolkit');

const utils = require('./utils/cacheAssets');

const pluginOptions = require('./utils/pluginOptionsSchema');
const { createSourceConfig } = require('./utils/createSourceConfig');
const { createSpecialFields } = require('./utils/createSpecialFields');
const { schemaCustomization } = require('./utils/schemaCustomization');
const { createNodes } = require('./utils/createNodes');


exports.pluginOptionsSchema = ({ Joi }) => {
  return Joi.object(pluginOptions);
};

exports.createSchemaCustomization = async (args, options) => {
  const { reporter } = args;
  const { buildMarkdownNodes = false } = options;

  const config = await createSourceConfig(args, options, reporter);
  const specialFields = await createSpecialFields(config, buildMarkdownNodes, reporter);

  utils._cache.schemaInformation = config;
  utils._cache.specialFields = specialFields;

  await toolkit.createSchemaCustomization(config);
  await schemaCustomization(args, options, config, specialFields);
};

exports.sourceNodes = async (args, options) => {
  const { reporter } = args;

  await createNodes(args, options, reporter);
};