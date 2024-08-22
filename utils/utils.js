"use strict"
const path = require('path');
const fs = require('fs-extra');
const graphql = require("graphql");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { print } = require('gatsby/graphql');

const types = require('./types');


async function fetchSchema({ operationName, query, variables = {} }, endpoint, token) {
  const res = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ query, variables, operationName }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  return await res.json();
};

const systemFieldArguments = (field) => {
  if (['createdAt', 'publishedAt', 'updatedAt'].includes(field.name)) {
    return { variation: 'COMBINED' };
  };
  if (field.args.find(a => a.name === 'first')) {
    return { first: 100 };
  };
  
  return undefined;
};

async function writeCompiledQueries(nodeDocs) {
  const mainDir = process.cwd(); 
  const debugDir = path.join(mainDir, '.cache', 'caches', 'gatsby-source-hygraph');

  await fs.ensureDir(debugDir);
  for (const [remoteTypeName, document] of nodeDocs) {
    await fs.writeFile(path.join(debugDir, `${remoteTypeName}.graphql`), print(document));
  };
};

async function addScheduledTypes(allowedTypes) {
  if (allowedTypes && allowedTypes.length > 0) {
    if (!allowedTypes.includes('ScheduledOperation')) {
      allowedTypes.push('ScheduledOperation');
    };
    if (!allowedTypes.includes('ScheduledRelease')) {
      allowedTypes.push('ScheduledRelease');
    };
    if (!allowedTypes.includes('User')) {
      allowedTypes.push('User');
    };
  };
};

function getRealType(valueType, level) {
  if (graphql.isListType(valueType)) {
      return getRealType(valueType.ofType, (level ?? 0) + 1);
  };
  if (graphql.isNonNullType(valueType)) {
      return getRealType(valueType.ofType, (level ?? 0) + 1);
  };

  return valueType;
};

function specialFieldsEntries(gatsbyApi, pluginOptions, level, typeName, specialsFields) {
  const { typePrefix } = pluginOptions;
  const { actions } = gatsbyApi;
  const { createTypes } = actions;
  const additions = [];

  specialsFields.forEach(entry => {
    if (types.specialField(entry)) {
      switch (entry.type) {
        case 'Markdown': additions.push(`${entry.field.name}MarkdownNode: ${typePrefix}MarkdownNode @link`);
        break;
        
        case 'RichText':
          {
            const valueType = entry.field.type;
            const fieldType = getRealType(valueType);
            
            createTypes(`
              type ${typePrefix}${fieldType.toString()} {
                cleaned: JSON
              }
            `);
          }
        break;
      };
    } else if (types.specialUnion(entry)) {
      specialFieldsMap(gatsbyApi, pluginOptions, false, entry.value);
    } else if (types.specialObject(entry)) {
      specialFieldsEntries(gatsbyApi, pluginOptions, false, typeName, entry.value);
    };
  });

  if (additions.length > 0) {
    createTypes(`
      type ${typePrefix}${typeName} ${level ? 'implements Node' : ""} {
        ${additions.join(",")}
      }
    `);
  };
};

function specialFieldsMap(gatsbyApi, pluginOptions, level, specialsFields) {
  specialsFields.forEach((fields, typeName) => {
    specialFieldsEntries(gatsbyApi, pluginOptions, level, typeName, fields);
  });
};

async function retry(fn, options) {
  let ms = options.minTimeout;
  for (let i = 0; i < options.retries; i++) {
    try {
      const result = await fn();
      
      return result;
    } catch (error) {
      if (i < options.retries - 1) {
        if (typeof error === "string" || error instanceof Error) {
          options.onRetry(error);
        } else {
          options.onRetry("" + error);
        };
      };
      
      await timeout(ms);
      ms += ms * options.factor;
    };
  };

  return undefined;
};

async function copyLocaleFile(sourcePath, targetPath) {
  const tempFile = targetPath + `.tmp-${performance.now()}`;
  await fs.rm(targetPath, { force: true });
  try {
    await fs.copyFile(sourcePath, tempFile);
    await fs.rename(tempFile, targetPath);
  } catch (ex) {
    if (!fs.existsSync(targetPath)) {
      throw ex;
    };
  } finally {
    await fs.rm(tempFile, { force: true });
  };
};

module.exports = {
  retry: retry,
  fetchSchema: fetchSchema,
  getRealType: getRealType,
  copyLocaleFile: copyLocaleFile,
  specialFieldsMap: specialFieldsMap,
  addScheduledTypes: addScheduledTypes,
  systemFieldArguments: systemFieldArguments,
  writeCompiledQueries: writeCompiledQueries
};