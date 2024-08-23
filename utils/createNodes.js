const toolkit = require('gatsby-graphql-source-toolkit');
const feature = require('gatsby-plugin-utils/has-feature');

const utils = require('./cacheAssets');

const {
  processNodesOfType,
  processDownloadable
} = require('./downloadAssets');


async function createNodes(gatsbyApi, pluginOptions, reporter) {
  const { actions } = gatsbyApi;
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

module.exports = { 
  createNodes: createNodes
};