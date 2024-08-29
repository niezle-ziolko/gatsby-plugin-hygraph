<h2 align="center">gatsby-plugin-hygraph</h2>
<p align="center">Unofficial plugin source from Hygraph (once Hygraph)</p>

This simplifies and adds some new features

- Everything is handled in source nodes rather than later
- Compatible with Gatsby v5
- Parallel asset downloading
- Incremental downloading
- Handles locales
- Produces clean Rich Text Fields
- Locally caches assets to prevent downloading multiple times

## Installation

```shell
npm install gatsby-plugin-hygraph
```

or

```shell
yarn add gatsby-plugin-hygraph
```

## Configuration

> We recommend using environment variables with your Hygraph `token` and `endpoint` values. You can learn more about using environment variables with Gatsby [here](https://www.gatsbyjs.org/docs/environment-variables).

### Authorization

You can also provide an auth token using the `token` configuration key. This is necessary if your Hygraph project is **not** publicly available, or you want to scope access to a specific content stage (i.e. draft content).

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN
      }
    }
  ]
};
```

### Options

| Key | Type | Description |
|--|--|--|
| `endpoint` | String (**required**) |  The endpoint URL for the Hygraph project. This can be found in the [project settings UI](https://hygraph.com/docs/developer-guides/project/api-access#working-with-apis).  |
| `token` | String | If your Hygraph project is **not** publicly accessible, you will need to provide a [Permanent Auth Token](https://hygraph.com/docs/api-reference/basics/authorization) to correctly authorize with the API. You can learn more about creating and managing API tokens [here](https://hygraph.com/docs/developer-guides/project/api-access#working-with-apis). |
| `stages` | String _(Default: `['PUBLISHED']`)_ | An array of Content Stages from your Hygraph project. [Learn more](#querying-from-content-stages). You can read more about using Content Stages [here](https://Hygraph.com/guides/working-with-content-stages). |
| `locales` | String _(Default: `['en']`)_ | An array of locale key strings from your Hygraph project. [Learn more](#querying-localised-nodes). You can read more about working with localisation in Hygraph [here](https://hygraph.com/docs/api-reference/content-api/localization). This builds complete models for each locale using the fallback locale. |
| `allowedTypes` | String _(Default: `''`)_ | A list of the types you want to import from your Hygraph schema into the application. [Learn more](#allowed-types). |
| `typePrefix` | String _(Default: `Hygraph`)\_ | The string by which every generated type name is prefixed with. For example, a type of `Post` in Hygraph would become `hygraphPost` by default. If using multiple instances of the source plugin, you **must** provide a value here to prevent type conflicts. |
| `downloadAssets` | Boolean _(Default: `true`)_ | Download and cache all Hygraph assets in your Gatsby project. [Learn more](#downloading-local-image-assets). |
| `downloadLocalImages` | Boolean _(Default: `false`)_ | Download non image assets (eg videos, svgs etc) |
| `concurrency` | Number _(Default: `50`)_ | How many asset downloads to run in parallel. |
| `interval` | Number _(Default: `1000`)_ | Intervals at which resources are to be retrieved from the Hygraph endpoint. The minimum interval is 300. The default interval is 1000. |
| `assetsDir` | String _(Default: `.assets`)_ | Set to the name of the local cache directory |
| `fragmentsDir` | String _(Default: `.fragments`)_ | The local project path where generated query fragments are saved. This is relative to your current working directory. If using multiple instances of the source plugin, you **must** provide a value here to prevent type and/or fragment conflicts. How |
| `buildMarkdownNodes` | Boolean _(Default: `false`)_ | Build markdown nodes for all [`RichText`](https://Hygraph.com/docs/reference/fields/rich-text) fields in your Hygraph schema. [Learn more](#using-markdown-nodes). |
| `markdownFields` | Object _(Default: `{}`)_ | Which models/fields are markdown causing a markdown node to be built. [Learn more](#using-markdown-fields). |
| `cleanupRichText` | Boolean _(Default: `true`)_ | Create a cleaned node in [`RichText`](https://Hygraph.com/docs/reference/fields/rich-text) fields in your Hygraph schema. These don't have empty elements and have replaced whitespace with a single space. |

## Features

- [Querying from content stages](#querying-from-content-stages)
- [Querying localised nodes](#querying-localised-nodes)
- [Set selected types to create a scheme](#allowed-types)
- [Downloading local image assets](#downloading-local-image-assets)
- [Using markdown nodes](#using-markdown-nodes)
- [Using markdown nodes](#using-markdown-fields)
- [Usage with `gatsby-plugin-image`](#usage-with-gatsby-plugin-image)
- [Working with query fragments](#working-with-query-fragments)

### Querying from content stages

This plugin provides support to build nodes for entries from multiple Content Stages.

The provided Content Stages **must** be accessible according to the configuration of your project's [API access](https://hygraph.com/docs/api-reference/basics/authorization). If providing a `token`, then that [Permanent Auth Token](https://hygraph.com/docs/api-reference/basics/authorization#permanent-auth-tokens) must have permission to query data from all provided Content Stages.

The example below assumes that both the `DRAFT` and `PUBLISHED` stages are publicly accessible.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        stages: ['DRAFT', 'PUBLISHED']
      }
    }
  ]
};
```

To query for nodes from a specific Content Stage, use the `filter` query argument.

```gql
{
  allHygraphProduct(filter: { stage: { eq: DRAFT } }) {
    nodes {
      name
    }
  }
}
```

### Querying localised nodes

If using Hygraph localisation, this plugin provides support to build nodes for all provided locales.
Update your plugin configuration to include the `locales` key.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        locales: ['en', 'pl']
      }
    }
  ]
};
```

To query for nodes for a specific locale, use the `filter` query argument.

```gql
{
  enProducts: allHygraphProduct(filter: { locale: { eq: en } }) {
    nodes {
      name
    }
  }
  plProducts: allHygraphProduct(filter: { locale: { eq: pl } }) {
    nodes {
      remoteId
      name
    }
  }
}
```

This creates local content nodes for all the locales produced. This allows simple multiple locale sites to be produced from partially localised content in the CMS.

### Set selected types to create a scheme

If only certain types are to be used in the project this plug-in supports the ability to narrow the types to be downloaded to only selected types.

Update your plugin configuration to include the `allowedTypes` key.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        allowedTypes: [
        'Asset',
        'Category',
        'Product',
        'Post'
        ]
      }
    }
  ]
};
```

After building the application in both development and production mode, only the schemes you add to the `allowedTypes` key will be available. It is not necessary to add system schemas such as `ScheduledOperation`, `ScheduledRelease` or `User` to the `allowedTypes` key, as they are added automatically.

### Usage with `gatsby-plugin-image`

> Requires [`gatsby-plugin-image`](https://www.gatsbyjs.com/plugins/gatsby-plugin-image) as a project dependency.

This source plugin supports `gatsby-plugin-image` for responsive, high performance Hygraph images direct from our CDN.

Use the `gatsbyImageData` resolver on your `Hygraph_Asset` nodes.

```gql
{
  allHygraphAsset {
    nodes {
      gatsbyImageData(layout: FULL_WIDTH)
    }
  }
}
```

#### `gatsbyImageData` resolver arguments

| Key | Type | Description |
|--|--|--|
| `aspectRatio` | Float | Force a specific ratio between the image’s width and height. |
| `backgroundColor` | String | Background color applied to the wrapper. |
| `breakpoints` | [Int] | Output widths to generate for full width images. Default is to generate widths for common device resolutions. It will never generate an image larger than the source image. The browser will automatically choose the most appropriate. |
| `height` | Int | Change the size of the image. |
| `layout` | GatsbyImageLayout (`CONSTRAINED`/`FIXED`/`FULL_WIDTH`) | Determines the size of the image and its resizing behavior. |
| `outputPixelDensities` | [Float] | A list of image pixel densities to generate. It will never generate images larger than the source, and will always include a 1x image. The value is multiplied by the image width, to give the generated sizes. For example, a `400` px wide constrained image would generate `100`, `200`, `400` and `800` px wide images by default. Ignored for full width layout images, which use `breakpoints` instead. |
| `quality` | Int | The default image quality generated. This is overridden by any format-specific options. |
| `sizes` | String | [The `<img> sizes` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attributes), passed to the img tag. This describes the display size of the image, and does not affect generated images. You are only likely to need to change this if your are using full width images that do not span the full width of the screen. |
| `width` | Int | Change the size of the image. |

For more information on using `gatsby-plugin-image`, please see the [documentation](https://www.gatsbyjs.com/plugins/gatsby-plugin-image/).

### Downloading local image assets

If you prefer, the source plugin also provides the option to download and cache Hygraph assets in your Gatsby project.

To enable this, add `downloadAssets: true` to your plugin configuration. This downloads all assets.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        downloadAssets: true
      }
    }
  ]
};
```

This adds a `localFile` field to the `Hygraph_Asset` type which resolves to the file node generated at build by [`gatsby-source-filesystem`](https://www.gatsbyjs.org/packages/gatsby-source-filesystem).

If you also want to add support for downloading images to local files, add the following settings.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        downloadAssets: true,
        downloadLocalImages: true
      }
    }
  ]
};
```

```gql
{
  allHygraphAsset {
    nodes {
      localFile {
        childImageSharp {
          gatsbyImageData(layout: FULL_WIDTH)
        }
      }
    }
  }
}
```

### Using markdown nodes

This source plugin provides the option to build markdown nodes for all `RichText` fields in your Hygraph schema, which in turn can be used with [MDX](https://mdxjs.com).

To enable this, add `buildMarkdownNodes: true` to your plugin configuration.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        buildMarkdownNodes: true
      }
    }
  ]
};
```

Enabling this option adds a `markdownNode` nested field to all `RichText` fields on the generated Gatsby schema.

#### Usage with `gatsby-plugin-mdx`

These newly built nodes can be used with [`gatsby-plugin-mdx`](https://www.gatsbyjs.org/packages/gatsby-plugin-mdx) to render markdown from Hygraph.

Once installed, you will be able to query for `MDX` fields using a query similar to the one below.

```gql
{
  allHygraphPost {
    nodes {
      id
      content {
        markdownNode {
          childMdx {
            body
          }
        }
      }
    }
  }
}
```

Check out the [demo source](https://github.com/hygraph/gatsby-source-graphcms/tree/main/demo) for an example of a full MDX implementation.

### Using markdown fields

This source plugin provides the option to build markdown nodes for all `RichText` fields in your Hygraph schema, which in turn can be used with [MDX](https://mdxjs.com).

To enable this, add something like `markdownFields: {Author: ['description']}` to your plugin configuration.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        markdownFields: {
          Author: [
            'description'
          ]
        }
      }
    }
  ]
};
```

Enabling this option adds a `descriptionMarkdownNode` field to the `description` fields on the `Author` schema. Other fields and schemas are added the same way

### Working with query fragments

The source plugin will generate and save GraphQL query fragments for every node type. By default, they will be saved in a `Hygraph-fragments` directory at the root of your Gatsby project. This can be configured:

> If using multiple instances of the source plugin, you **must** provide a value to prevent type and/or fragment conflicts.

```js
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-hygraph',
      options: {
        endpoint: process.env.HYGRAPH_ENDPOINT,
        token: process.env.HYGRAPH_TOKEN,
        fragmentsDir: '.fragments'
      }
    }
  ]
};
```

The generated fragments are then read from the project for subsequent builds. It is recommended that they are checked in to version control for your project.

Should you make any changes or additions to your Hygraph schema, you will need to update the query fragments accrdingly. Alternatively they will be regnerated on a subsequent build after removing the directory from your project.

#### Modifying query fragments

In some instances, you may need modify query fragments on a per type basis. This may involve:

- Removing unrequired fields
- Adding new fields with arguments as an aliased field

For example, adding a `featuredCaseStudy` field:

```graphql
fragment Industry on Industry {
  featuredCaseStudy: caseStudies(where: { featured: true }, first: 1)
}
```

Field arguments cannot be read by Gatsby from the Hygraph schema. Instead we must alias any required usages as aliased fields. In this example, the `featuredCaseStudy` field would then be available in our Gatsby queries:

```graphql
{
  allHygraphIndustry {
    nodes {
      featuredCaseStudy {
        ...
      }
    }
  }
}
```

#### Authors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/niezle-ziolko">
        <img src="https://cdn.buymeacoffee.com/uploads/profile_pictures/2024/08/4I7EgETWU4MsmODA.jpg@300w_0e.webp" width="100px;" alt=""/>
        <br><sub><b>_realNormanik</b></sub></br>
      </a>
      <br></br>
      <a href="https://github.com/niezle-ziolko" title="Code">💻</a>
    </td>
    <td>
      <p>I don't like my current job so I do programming as a hobby. If you want to support my passion and help me get away from my full-time job at an outsourcing hotline then I encourage you to buy me a coffee 😃. </p>
   <a href="https://www.buymeacoffee.com/_realNormanik" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="150px"></a>
    </td>
  </tr>
</table>

The plugin can be used by anyone free of charge. The exception is the company Stellantis N.V. and any body working with the company.