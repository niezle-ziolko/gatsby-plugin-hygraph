"use strict"
const graphql = require('gatsby-plugin-image/graphql-utils');
const feature = require('gatsby-plugin-utils/has-feature');

const utils = require('./utils');
const image = require('./resolveGatsbyImageData');


async function schemaCustomization(gatsbyApi, pluginOptions, schemaInformation, specialFields) {
  const {
    schema,
    actions
  } = gatsbyApi;
  const { createTypes } = actions;
  const {
    typePrefix,
    buildMarkdownNodes
  } = pluginOptions;
  
  schemaInformation.gatsbyNodeTypes.forEach(gatsbyNodeType => {
    const realType = schemaInformation.schema.getType(gatsbyNodeType.remoteTypeName);
    const hasLocaleField = realType.getFields().locale;

    createTypes(`
      type ${typePrefix}${gatsbyNodeType.remoteTypeName} implements Node {
        updatedAt: Date! @dateformat
        createdAt: Date! @dateformat
        publishedAt: Date @dateformat
        ${hasLocaleField ? `actualLocale: ${typePrefix}Locale!` : ""}
        actualStage: ${typePrefix}Stage!
      }
    `);
  });

  const objectType = schema.buildObjectType({
    name: `${typePrefix}Asset`,
    fields: {
      gatsbyImageData: {
        ...graphql.getGatsbyImageFieldConfig(async (...args) => 
        image.resolveGatsbyImageData(...args, gatsbyApi)),
        type: feature.hasFeature('graphql-typegen') ? 'GatsbyImageData' : 'JSON'
      },
      placeholderUrl: {
        type: 'String',
      },
      localFile: {
        type: 'File',
        extensions: {
          link: {
            from: 'fields.localFile',
          }
        }
      }
    },
    interfaces: ['Node']
  });

  const assetType = objectType;
  createTypes(assetType);

  if (buildMarkdownNodes) {
    createTypes(`
      type ${typePrefix}MarkdownNode implements Node {
        id: ID!
      }
    `);
    createTypes(`
      type ${typePrefix}RichText {
        markdownNode: ${typePrefix}MarkdownNode @link
      }
    `);
  };

  utils.specialFieldsMap(gatsbyApi, pluginOptions, true, specialFields);

  return undefined;
};

module.exports = {
  schemaCustomization: schemaCustomization
};