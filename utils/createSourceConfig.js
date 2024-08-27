"use strict";
const fs = require('fs-extra');
const toolkit = require('gatsby-graphql-source-toolkit');

const utils = require('./utils');


async function createSourceConfig(gatsbyApi, pluginOptions, reporter) {
  const {
    token,
    stages, 
    locales,
    endpoint,
    interval,
    typePrefix,
    concurrency,
    allowedTypes,
    fragmentsDir
  } = pluginOptions;

  utils.addScheduledTypes(allowedTypes);

  if (!endpoint) {
    reporter.panic(new Error('Missing endpoint or token'));
  };

  const execute = toolkit.wrapQueryExecutorWithQueue(
    (operation) => utils.fetchSchema(operation, endpoint, token),
    { concurrency: concurrency, interval: interval }
  );

  const schema = await toolkit.loadSchema(execute);
  const nodeInterface = schema.getType('Node');
  const queryFields = schema.getType('Query').getFields();
  const possibleTypes = schema.getPossibleTypes(nodeInterface);

  const pluralFieldName = (type) => 
    Object.keys(queryFields).find(fieldName => 
      String(queryFields[fieldName].type) === `[${type.name}!]!`
    );

  const gatsbyNodeTypes = possibleTypes
    .filter(type => !allowedTypes || allowedTypes.includes(type.name))
    .map(type => {
      const plural = pluralFieldName(type);

      const queries = locales.flatMap(locale => {
        const localeLabel = locale.replace('_', '');
        return stages.map(stage => 
          `query LIST_${plural}_${localeLabel}_${stage} { 
            ${plural}(first: $limit, ${type.getFields().locale ? `locales: ${locale}` : ""}, stage: ${stage}, skip: $offset) {
              ..._${type.name}_
            }
          }`
        );
      });

      const fields = [
        '__typename',
        'id',
        'stage',
        type.getFields().locale ? 'locale' : null
      ].filter(Boolean).join('\n');

      const config = {
        remoteTypeName: type.name,
        queries: [
          ...queries,
          `fragment _${type.name}_ on ${type.name} {
            ${fields}
          }`
        ].join('\n'),
        
        nodeQueryVariables: ({ id, stage, locale }) => ({
          where: { id },
          locales: [locale],
          stage
        })
      };
      
      return config;
    });

  fs.ensureDir(fragmentsDir);
  reporter.success(`${fragmentsDir} is created.`);

  const fragments = await toolkit.readOrGenerateDefaultFragments(
    fragmentsDir,
    { 
      schema, 
      gatsbyNodeTypes,
      defaultArgumentValues: [utils.systemFieldArguments]
    }
  );

  const documents = toolkit.compileNodeQueries({
    schema,
    gatsbyNodeTypes,
    customFragments: fragments,
  });

  await utils.writeCompiledQueries(documents);

  return {
    gatsbyApi,
    schema,
    execute: execute,
    gatsbyNodeTypes,
    gatsbyTypePrefix: typePrefix,
    gatsbyNodeDefs: toolkit.buildNodeDefinitions({ gatsbyNodeTypes, documents })
  };
};

module.exports = { createSourceConfig };