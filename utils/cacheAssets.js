"use strict";

const path = require('path');
const fs = require('fs-extra');
const filesystem = require('gatsby-source-filesystem');
const utils = require('./utils');


const _cache = {};

const promiseCache = new Map();

function getLocalFileName(remoteAsset) {
  return remoteAsset.fileName.replace(/[/\s\\?%*:|"<>]/g, "-");
};

async function internalCreateLocalFile(context, remoteAsset, pluginOptions) {
  const { gatsbyApi } = context;
  const {
    cache,
    store,
    actions,
    reporter,
    getCache,
    createNodeId
  } = gatsbyApi;
  const { createNode } = actions;
  const { assetsDir } = pluginOptions;
  
  const url = remoteAsset.url;
  const fileName = getLocalFileName(remoteAsset);
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);
  const relativePath = new URL(url).pathname;
  const fullPath = path.join(process.cwd(), assetsDir, relativePath);

  const createFileNode = {
    createNode,
    createNodeId,
    getCache,
    cache,
    store,
    reporter,
    name,
    ext
  };

  try {
    const buffer = await fs.readFile(fullPath);
    const fileNode = await filesystem.createFileNodeFromBuffer({
      buffer,
      ...createFileNode,
    });
    
    reporter.verbose(`Using cached asset ${fileName} from ${fullPath}`);
    
    return fileNode.id;
  } catch {
    reporter.verbose(`Downloading asset ${fileName} from ${url}`);
    
    const remoteFileNode = await utils.retry(async () => {
      const node = await filesystem.createRemoteFileNode({
        url,
        ...createFileNode
      });
    
      return node;
    }, {
      retries: 3,
      factor: 1.1,
      minTimeout: 5000,
      onRetry: error => {
        reporter.warn(`Error downloading url ${url}: ${typeof error === "string" ? error : error.message}`);
      }
    });

    if (!remoteFileNode) {
      reporter.panic(`Failed to download url: ${url}`);
      throw new Error('Failed to download');
    };
    
    try {
      await fs.ensureDir(path.dirname(fullPath));
      await utils.copyLocaleFile(remoteFileNode.absolutePath, fullPath);
    } catch (e) {
      reporter.panic('Failed to copy asset', e);
    };

    reporter.verbose(`Downloaded asset ${fileName} from ${url}`);
    
    return remoteFileNode.id;
  };
};

async function createLocalFile(context, remoteAsset, pluginOptions) {
  const { gatsbyApi } = context;
  const { reporter } = gatsbyApi;
  const url = remoteAsset.url;
  const current = promiseCache.get(url);
  
  if (current) {
    reporter.verbose(`Using cached request for ${url}`);
    return current;
  };
  
  const request = internalCreateLocalFile(context, remoteAsset, pluginOptions);
  promiseCache.set(url, request);
  
  try {
    return await request;
  } finally {
    promiseCache.delete(url);
  };
};

module.exports = {
  _cache: _cache,
  createLocalFile: createLocalFile,
  getLocalFileName: getLocalFileName
};