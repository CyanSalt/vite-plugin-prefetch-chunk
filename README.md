# vite-plugin-prefetch-chunk

[![npm](https://img.shields.io/npm/v/vite-plugin-prefetch-chunk.svg)](https://www.npmjs.com/package/vite-plugin-prefetch-chunk)

Vite plugin for adding prefetch resource hints in HTML.

`<link rel="prefetch">` is a type of resource hint that tells the browser to prefetch content that the user may visit in the near future in the browser's idle time, after the page finishes loading.

In most cases, prefetching all asynchronous chunks is not a wise choice, especially when using code splitting with router: this will cause the client to always download resources of all routes, even if those pages will never be visited.

Prefetch links will consume bandwidth, which is often unacceptable if you have a large app with many async chunks and your users are primarily mobile and thus bandwidth-aware. Therefore, this plugin is designed to be used in a way that requires manual declaration on the asynchronous module that you want to be prefetched.

## Installation

```shell
npm install --save-dev vite-plugin-prefetch-chunk
```

## Usage

```js
// vite.config.js
import prefetchChunk from 'vite-plugin-prefetch-chunk'

export default {
  plugins: [
    prefetchChunk(),
  ],
}
```

There are two ways to prefetch an async module:

### Virtual Module (recommended)

You can add an additional import statement in the module **that you want to be prefetched**:

```ts
// my-module.ts
import 'virtual:prefetch'
```

After doing this, the plugin will generate resource hints for the bundle containing this module **when it is imported asynchronously**. Virtual modules within synchronized blocks will be ignored.

This solution obviously does not apply to assets. For files without import/export, another way could be used.

### Resource Query

You can also add the resource query `?prefetch` when importing a module asynchronously, just like [`?raw` or `?worker`](https://vitejs.dev/guide/assets.html#importing-asset-as-string):

```ts
import(`./my-module?prefetch`)
```

This is somewhat similar to [`/* webpackPrefetch: true */`](https://webpack.js.org/guides/code-splitting/#prefetchingpreloading-modules). When the query is specified, the plugin will generate resource hints for the bundle containing this module.

It is worth noting that TypeScript cannot resolve resource queries correctly, so **it is recommended to use this way for assets only**. And, in order to support TypeScript, you may also need to add type declarations to your global `.d.ts` similar to the following:

```ts
import 'vite/client';

declare module '*?prefetch' {
   // export type declaration
   // ...
}
```

## Options

### `prefetchLegacyChunks`

- **Type:** `boolean`

   Whether to add prefetch links for legacy chunks.

   By default, legacy chunks generated by [`@vitejs/plugin-legacy`](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy) or [`vite-plugin-legacy-swc`](https://github.com/CyanSalt/vite-plugin-legacy-swc) will not be prefetched. This is to ensure that modern browsers download additional files as less as possible.

   If you specify `renderModernChunks: true` for `@vitejs/plugin-legacy` or `vite-plugin-legacy-swc`, it is recommended to enable this option to enable prefetch capabilities.
