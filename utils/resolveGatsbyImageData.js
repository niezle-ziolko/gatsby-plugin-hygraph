"use strict";
const path = require('path');
const promises = require('fs/promises');
const { getDominantColor } = require('gatsby-plugin-sharp');
const { fetchRemoteFile } = require('gatsby-core-utils/fetch-remote-file');
const { generateImageData, getLowResolutionImageURL } = require('gatsby-plugin-image');
const { getPluginOptions, doMergeDefaults } = require('gatsby-plugin-sharp/plugin-options');


function isImage(mimeType) {
  return mimeType.startsWith('image/') && mimeType.indexOf('/svg') === -1;
};
function getBase64DataURI(imageBase64) {
  return `data:image/png;base64,${imageBase64}`;
};

function generateImageSource(handle, width, height, format, fit, options) {
  if (!Number.isFinite(height))
    height = width;
  
  const args = ['https://media.graphassets.com'];
    
  if (width || height) {
    let filestackFit = 'crop';
    switch (fit) {
      case 'contain':
        filestackFit = 'clip';
        break;

      case 'fill':
      case 'inside':
      case 'outside':
      case 'cover':
        filestackFit = 'crop';
        break;
    };
      
    args.push(`resize=${Number.isFinite(width) && width > 0 ? `w:${width},` : ''}${Number.isFinite(height) && height > 0 ? `h:${height},` : ''}${options?.align ? `a:${options.align},` : ''}${options?.filter ? `ft:${options.filter},` : ''}f:${filestackFit}`);
  };

  if (options?.crop) {
    args.push(`crop=d:${options.crop}`);
  };

  let filestackFormat;
  switch (format) {
    case 'auto':
      filestackFormat = 'auto';
      args.push('auto_image');
      break;

    case 'avif':
    case 'webp':
      filestackFormat = 'webp';
      args.push('output=f:webp');
      break;

    case 'jpg':
      filestackFormat = 'jpg';
      args.push('output=f:jpg');
      break;

    default:
      filestackFormat = 'png';
      args.push('output=f:png');
      break;
  };

  args.push(handle);
  const src = args.join('/');
    
  return { width, height, format: filestackFormat, src };
};

async function resolveGatsbyImageData(image, options, _context, _info, { reporter, cache }) {
  if (!isImage(image.mimeType))
    return null;

  let format = image.mimeType.split('/')[1];
  if (format === 'jpeg') {
    format = 'jpg';
  };

  const sourceMetadata = {
    width: image.width,
    height: image.height,
    format: format
  };

  const sharpOptions = getPluginOptions();
  const userDefaults = sharpOptions.defaults;
  const defaults = {
    tracedSVGOptions: {},
    blurredOptions: {},
    jpgOptions: {},
    pngOptions: {},
    webpOptions: {},
    gifOptions: {},
    avifOptions: {},
    quality: 50,
    placeholder: `dominantColor`,
    ...userDefaults,
  };
    
  options = doMergeDefaults(options, defaults);
  
  if (options.placeholder && options.placeholder === 'tracedSVG') {
    if (!haveWarnedAboutPlaceholder) {
      reporter.warn('Does not support tracedSVG');
      haveWarnedAboutPlaceholder = true;
    };

    options.placeholder = 'dominantColor';
  };

  const imageDataArgs = {
    ...options,
    pluginName: 'gatsby-source-hygraph',
    sourceMetadata,
    filename: image.handle,
    generateImageSource,
    options
  };

  const imageData = generateImageData(imageDataArgs);
  if (
    options.placeholder === 'blurred' ||
    options.placeholder == 'dominantColor'
  ) {
    const lowResImageUrl = getLowResolutionImageURL(imageDataArgs, 20);
    const filePath = await fetchRemoteFile({
      url: lowResImageUrl,
      name: image.handle,
      directory: cache.directory,
      ext: path.extname(image.fileName),
      cacheKey: image.internal.contentDigest,
    });

    if (options.placeholder === 'blurred') {
      const buffer = await promises.readFile(filePath);
      const base64 = buffer.toString('base64');
      
      imageData.placeholder = {
        fallback: getBase64DataURI(base64)
      };
    } else {
      imageData.backgroundColor = await getDominantColor(filePath);
    };
  };

  return generateImageData(imageDataArgs);
};

module.exports = { resolveGatsbyImageData };