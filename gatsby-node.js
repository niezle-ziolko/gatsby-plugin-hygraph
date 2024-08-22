"use strict"
const toolkit = require('gatsby-graphql-source-toolkit');
const feature = require('gatsby-plugin-utils/has-feature');

const utils = require('./utils/cacheAssets');

const {
  processNodesOfType,
  processDownloadable
} = require('./utils/downloadAssets');
const pluginOptions = require('./utils/pluginOptionsSchema');
const { createSourceConfig } = require('./utils/createSourceConfig');
const { createSpecialFields } = require('./utils/createSpecialFields');
const { schemaCustomization } = require('./utils/schemaCustomization');


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


exports.sourceNodes = async (gatsbyApi, pluginOptions) => {
  const {
    actions,
    reporter
  } = gatsbyApi;
  const { enableStatefulSourceNodes } = actions;
  const schemaConfig = utils._cache.schemaInformation;
  
  if (!schemaConfig) {
    return reporter.panic('No schema configuration');
  };

  const isStateful = feature.hasFeature('stateful-source-nodes') && !!enableStatefulSourceNodes;
  
  if (isStateful) {
    enableStatefulSourceNodes();
  };

  const context = toolkit.createSourcingContext(schemaConfig);
  const promises = [];
  const specialFields = utils._cache.specialFields;

  if (!specialFields) {
    return reporter.panic('Special fields not initialised');
  };

  for (const remoteTypeName of context.gatsbyNodeDefs.keys()) {
    reporter.verbose(`Processing nodes of type ${remoteTypeName}`);
    
    if (remoteTypeName !== 'Asset') {
      const remoteNodes = toolkit.fetchAllNodes(context, remoteTypeName);
      const promise = processNodesOfType(pluginOptions, context, remoteTypeName, remoteNodes, specialFields.get(remoteTypeName), isStateful);
      
      promises.push(promise);
    };
  };

  await Promise.all(promises);
  const remoteAssets = toolkit.fetchAllNodes(context, 'Asset');
  await processDownloadable(pluginOptions, context, 'Asset', remoteAssets, isStateful);

  return undefined;
};