"use strict";
const graphql = require('graphql');

const utils = require('./utils');
const specialNames = new Set(['stage', 'locale', 'localizations']);


function assetField(type) {
  const name = type?.toString();
  return name === 'Asset';
};
function richTextField(type) {
  const name = type?.toString();
  return name?.endsWith('RichText');
};
function markdownField(fieldName, buildMarkdownNodes) {
  if (buildMarkdownNodes && fieldName) {
    return buildMarkdownNodes.includes(fieldName);
  };

  return false;
};

function createType(type, knownTypes, typeName, buildMarkdownNodes, reporter) {
  const specialFields = [];
  const typebuildMarkdownNodes = buildMarkdownNodes ? buildMarkdownNodes[type.name] : undefined;

  if (!type || !type.getFields) {
    reporter.warn(`Invalid type provided for processing: ${typeName}`);
    return undefined;
  };

  Object.entries(type.getFields()).forEach(([fieldName, field]) => {
    if (specialNames.has(fieldName)) {
      return;
    };

    const valueType = field.type;
    const fieldType = utils.getRealType(valueType);
    const isScalar = graphql.isScalarType(fieldType);
    const isEnum = graphql.isEnumType(fieldType);
    const fieldTypeName = fieldType?.toString();
    const isKnown = knownTypes.has(fieldTypeName) || fieldTypeName === type.name;
    
    if (assetField(fieldType)) {
      specialFields.push({ fieldName, type: 'Asset', field });
    } else if (richTextField(fieldType)) {
      specialFields.push({ fieldName, type: 'RichText', field });
    } else if (markdownField(fieldName, typebuildMarkdownNodes)) {
      specialFields.push({ fieldName, type: 'Markdown', field });
    } else if (!isKnown && graphql.isUnionType(fieldType)) {
      const map = new Map();
      const containedTypes = fieldType.getTypes();

      containedTypes.forEach(containedType => {
        const unionFieldType = utils.getRealType(containedType);
    
        if (graphql.isObjectType(unionFieldType)) {
          const isContainedKnown = knownTypes.has(unionFieldType.name) || unionFieldType.name === type.name;
          
          if (!isContainedKnown) {
            const entries = createType(containedType, knownTypes, typeName, buildMarkdownNodes, reporter);
                  
            if (entries) {
              map.set(containedType.name, entries);
            };
          };
        };
      });

      if (map.size > 0) {
        specialFields.push({ fieldName, type: 'Union', value: map });
      };
    } else if (!isKnown && graphql.isObjectType(fieldType)) {
      const entries = createType(fieldType, knownTypes, typeName, buildMarkdownNodes, reporter);
      
      if (entries) {
        specialFields.push({ fieldName, type: 'Object', value: entries });
      };
    } else if (!isKnown && !isScalar && !isEnum) {
      reporter.warn(`What to do with field ${fieldName}: (${fieldType.toString()}) ${fieldName} (known ${isKnown}, isScalar ${isScalar}, isEnum ${isEnum}, isObject ${graphql.isObjectType(fieldType)})`);
    };
  });

  if (specialFields.length > 0) {
    return specialFields;
  };

  return undefined;
};

async function createSpecialFields(gatsbyApi, buildMarkdownNodes, reporter) {
  const { schema } = gatsbyApi;

  const nodeInterface = schema.getType('Node');
  const possibleTypes = schema.getPossibleTypes(nodeInterface);
  const knownTypes = new Set(possibleTypes.map(t => t.name));
  const specialFieldsMap = new Map();
  
  possibleTypes.forEach(type => {
    const entries = createType(type, knownTypes, type.name, buildMarkdownNodes, reporter);

    if (entries) {
      specialFieldsMap.set(type.name, entries);
    };
  });

  return specialFieldsMap;
};

module.exports = { createSpecialFields };