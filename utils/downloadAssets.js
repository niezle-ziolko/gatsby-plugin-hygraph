"use strict"
const path = require('path');
const filesystem = require('gatsby-source-filesystem');

const types = require('./types');
const cacheAssets = require('./cacheAssets');
const richText = require('./createRichText');


async function downloadAsset(context, remoteAsset) {
  const { gatsbyApi } = context;
  const {
    actions,
    reporter,
    getCache,
    createNodeId
  } = gatsbyApi;
  const { createNode } = actions;
  const fileName = cacheAssets.getLocalFileName(remoteAsset);
  const ext = fileName && path.extname(fileName);
  const name = fileName && path.basename(fileName, ext);
  const url = remoteAsset.url;
  const fileNode = await filesystem.createRemoteFileNode({
    url,
    createNode,
    createNodeId,
    getCache,
    cache: undefined,
    name,
    ext,
  });

  reporter.verbose(`Downloaded asset ${fileName} from ${url} with id ${fileNode.id}`);

  return fileNode.id;
};

async function workload(workers, count = 50) {
  const methods = workers.slice();
  async function task() {
    while (methods.length > 0) {
      const method = methods.pop();
      
      if (method) {
        await method();
      };
    };
  };
  
  await Promise.all(new Array(count).fill(undefined).map(() => task()));
};

function keepExistingNodeAlive(context, pluginOptions, remoteTypeName, specialFields, existingNode, namePrefix) {
  const { buildMarkdownNodes } = pluginOptions;
  const { gatsbyApi } = context;
  const {
    actions,
    getNode,
    reporter
  } = gatsbyApi;

  specialFields?.forEach(entry => {
    const name = entry.fieldName;
    const value = existingNode[name];
    
    if (!value)
    return;
      
    const fullName = namePrefix + name;
      
    if (types.specialField(entry)) {
      const field = entry.field;
      const fieldName = field.name;
      
      switch (entry.type) {
        case 'Asset':
        break;
        case 'Markdown':
          {
            const markdownNodeFieldName = `${fieldName}MarkdownNode`;
            const markdownNodeId = existingNode[markdownNodeFieldName];
            
            if (markdownNodeId) {
              const markdownNode = getNode(markdownNodeId);

              if (markdownNode) {
                actions.touchNode(markdownNode);
              } else {
                reporter.warn(`Failed to find markdown node ${markdownNodeId}`);
              };
            } else {
              reporter.warn(`No markdown node for ${fieldName}`);
            };
          }
        break;
        case 'RichText':
          {
            const processField = (field) => {
              if (buildMarkdownNodes) {
                const markdownNodeId = field.markdownNode;

                if (markdownNodeId) {
                  const markdownNode = getNode(markdownNodeId);

                  if (markdownNode) {
                    actions.touchNode(markdownNode);
                  };
                };
              };
            };

            if (Array.isArray(value)) {
              value.forEach(field => processField(field));
            } else {
              processField(value);
            };
          };
        break;
      };
    } else if (types.specialUnion(entry)) {
      const process = (value) => {
        entry.value.forEach(fields => {
          keepExistingNodeAlive(context, pluginOptions, remoteTypeName, fields, value, fullName);
        });
      };

      if (Array.isArray(value)) {
        value.forEach(process);
      } else {
        process(value);
      };
    } else if (types.specialObject(entry)) {
      const process = (value) => {
        keepExistingNodeAlive(context, pluginOptions, remoteTypeName, entry.value, value, fullName);
      };

      if (Array.isArray(value)) {
        value.forEach(process);
      } else {
        process(value);
      };
    };
  });
};

async function processRichTextField(gatsbyApi, pluginOptions, field, fieldName, parentId) {
  const {
    actions,
    createContentDigest
  } = gatsbyApi;
  const { createNode } = actions;
  const {
    typePrefix,
    cleanupRichText,
    buildMarkdownNodes
  } = pluginOptions

  if (cleanupRichText) {
    const raw = field.raw ?? field.json;
    
    if (raw) {
      field.cleaned = richText.cleanupRichTextContent(raw);
    };
  };

  if (buildMarkdownNodes) {
    const content = field.markdown;

    if (content) {
      const markdownNode = {
        id: `${fieldName}MarkdownNode:${parentId}`,
        parent: parentId,
        internal: {
        type: `${typePrefix}MarkdownNode`,
        mediaType: 'text/markdown',
        content,
        contentDigest: createContentDigest(content),
        }
      };
      
      await createNode(markdownNode);
      field.markdownNode = markdownNode.id;
    };
  };
};

async function createSpecialNodes(pluginOptions, context, remoteTypeName, specialFields, id, node, namePrefix) {
  const { typePrefix } = pluginOptions;
  const { gatsbyApi } = context;
  const {
    actions,
    createContentDigest
  } = gatsbyApi;
  const { createNode } = actions;

  if (specialFields) {
    for (const entry of specialFields) {
      const name = entry.fieldName;
      const fullName = namePrefix + name;
      const value = node[name];
      
      if (!value)
      continue;

      if (types.specialField(entry)) {
        switch (entry.type) {
          case 'Asset':
          break;
          case 'Markdown': {
            const content = value;

            if (content) {
              const markdownNode = {
                id: `${fullName}MarkdownNode:${id}`,
                parent: id,
                internal: {
                  type: `${typePrefix}MarkdownNode`,
                  mediaType: 'text/markdown',
                  content,
                  contentDigest: createContentDigest(content),
                }
              };

              await createNode(markdownNode);
              node[`${name}MarkdownNode`] = markdownNode.id;
            };
            break;
          };
          case 'RichText': {
            if (value) {
              if (Array.isArray(value)) {
                for (const field of value) {
                  await processRichTextField(gatsbyApi, pluginOptions, field, fullName, id);
                };
              } else {
                await processRichTextField(gatsbyApi, pluginOptions, value, fullName, id);
              };
            };
          };
        };
      } else if (types.specialUnion(entry)) {
        const process = async (value) => {
          for (const [, fields] of entry.value) {
            await createSpecialNodes(pluginOptions, context, remoteTypeName, fields, id, value, fullName);
          };
        };

        if (Array.isArray(value)) {
          for (const v of value) {
            await process(v);
          };
        } else {
          await process(value);
        };
      } else if (types.specialObject(entry)) {
        const process = async (value) => {
          await createSpecialNodes(pluginOptions, context, remoteTypeName, entry.value, id, value, fullName);
        };

        if (Array.isArray(value)) {
          for (const v of value) {
            await process(v);
          };
        } else {
          await process(value);
        };
      };
    };
  };
};

async function createOrTouchNode(pluginOptions, context, remoteTypeName, remoteNode, specialFields, isStateful, isAsset) {
  const { gatsbyApi } = context;
  const {
    actions,
    getNode,
    createContentDigest,
  } = gatsbyApi;
  const def = context.gatsbyNodeDefs.get(remoteTypeName);

  if (!def) {
    throw new Error(`Cannot get definition for ${remoteTypeName}`);
  };

  const contentDigest = createContentDigest(remoteNode);
  const id = context.idTransform.remoteNodeToGatsbyId(remoteNode, def);
  const existingNode = getNode(id);

  if (existingNode) {
    if (contentDigest === existingNode.internal.contentDigest) {
      if (!isStateful) {
        actions.touchNode(existingNode);
        
        const localFileNodeId = existingNode.fields ?.localFile;
              
        if (localFileNodeId) {
          const localFileNode = getNode(localFileNodeId);

          if (localFileNode) {
            actions.touchNode(localFileNode, undefined);
          };
        };

        keepExistingNodeAlive(context, pluginOptions, remoteTypeName, specialFields, existingNode, "");
      };

      return {
        id,
        touched: true
      };
    };
  };

  const node = {
    ...remoteNode,
    id,
    parent: undefined,
    internal: {
      contentDigest,
      type: context.typeNameTransform.toGatsbyTypeName(remoteTypeName),
    }
  };

  if (isAsset) {
    const asset = remoteNode;

    node.filename = asset.fileName;
  };

  await createSpecialNodes(pluginOptions, context, remoteTypeName, specialFields, id, node, "");
  await actions.createNode(node);

  return {
    id,
    touched: false
  };
};

async function processDownloadable(pluginOptions, context, remoteTypeName, remoteNodes, stateful) {
  const {
    assetsDir,
    concurrency,
    downloadAssets,
    downloadLocalImages
  } = pluginOptions;
  const { gatsbyApi } = context;
  const {
    getNode,
    actions,
    reporter
  } = gatsbyApi;
  const { createNodeField } = actions;

  const nodesToDownload = [];
  for await (const remoteNode of remoteNodes) {
    const asset = remoteNode;
    const isImage = asset.mimeType.startsWith('image/') && !asset.mimeType.includes('svg');
    const shouldDownload = downloadAssets && (!isImage || (isImage && downloadLocalImages));
    
    const { id } = await createOrTouchNode(pluginOptions, context, remoteTypeName, remoteNode, undefined, stateful, true);
    
    if (shouldDownload) {
      nodesToDownload.push(id);
    };
  };

  if (downloadAssets) {
    const bar = reporter.createProgress('Downloading hygraph assets', nodesToDownload.length);
    bar.start();

    await workload(nodesToDownload.map(nodeId => async () => {
      try {
        const node = getNode(nodeId);

        if (!node) {
          reporter.warn(`Failed to find node for "${nodeId}"`);
          return;
        };

        const asset = node;
        const localFileId = await (downloadAssets ? cacheAssets.createLocalFile(context, asset, pluginOptions) : downloadAsset(context, asset));
        reporter.verbose(`Using localFileId of ${localFileId} for ${asset.fileName} (${asset.url})`);

        createNodeField({
          node,
          name: 'localFile',
          value: localFileId
        });
      } catch (error) {
        reporter.error(`Error downloading node "${nodeId}"`, error);
      } finally {
        bar.tick();
      };
    }), concurrency);
    bar.end();

    reporter.success(`${assetsDir} is created.`);
  };
};

async function processNodesOfType(pluginOptions, context, remoteTypeName, remoteNodes, specialFields, isStateful) {
  const typeName = context.typeNameTransform.toGatsbyTypeName(remoteTypeName);
  const existing = context.gatsbyApi.getNodesByType(typeName);
  const existingSet = new Set(existing.map(e => e.id));
  let existingNodes = 0;
  let newNodes = 0;
  let touchedCount = 0;

  for await (const remoteNode of remoteNodes) {
    const { id: newId, touched } = await createOrTouchNode(pluginOptions, context, remoteTypeName, remoteNode, specialFields, isStateful, false);
    
    if (touched)
    touchedCount++;
      
    if (existingSet.delete(newId)) {
      existingNodes++;
    } else {
      newNodes++;
    };
  };

  const oldNodes = existingSet.size;
  let deletedNodes = 0;
    
  if (oldNodes) {
    existingSet.forEach(id => {
      const oldNode = existing.find(n => n.id === id);

      if (oldNode) {
        context.gatsbyApi.actions.touchNode(oldNode);
        context.gatsbyApi.actions.deleteNode(oldNode);
        deletedNodes++;
      };
    });
  };

  context.gatsbyApi.reporter.verbose(`Processed ${newNodes} new, ${touchedCount} touched, ${existingNodes} existing and ${oldNodes} old nodes for ${remoteTypeName}. Deleted ${deletedNodes}.`);
};

module.exports = {
  processNodesOfType: processNodesOfType,
  processDownloadable: processDownloadable
};