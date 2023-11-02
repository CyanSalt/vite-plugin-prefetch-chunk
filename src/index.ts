import * as path from 'path'
import type { Plugin, ResolvedConfig, Rollup } from 'vite'
import { normalizePath } from 'vite'

// Duplicated from build.ts in Vite Core, at least while the feature is experimental
// We should later expose this helper for other plugins to use
function toOutputFilePathInHtml({
  filename,
  type,
  hostId,
  hostType,
  config,
  toRelative,
}: {
  filename: string,
  type: 'asset' | 'public',
  hostId: string,
  hostType: 'js' | 'css' | 'html',
  config: ResolvedConfig,
  toRelative: (filename: string, importer: string) => string,
}): string {
  const { renderBuiltUrl } = config.experimental
  let relative = config.base === '' || config.base === './'
  if (renderBuiltUrl) {
    const result = renderBuiltUrl(filename, {
      hostId,
      hostType,
      type,
      ssr: Boolean(config.build.ssr),
    })
    if (typeof result === 'object') {
      if (result.runtime) {
        throw new Error(
          `{ runtime: "${result.runtime}" } is not supported for assets in ${hostType} files: ${filename}`,
        )
      }
      if (typeof result.relative === 'boolean') {
        relative = result.relative
      }
    } else if (result) {
      return result
    }
  }
  if (relative && !config.build.ssr) {
    return toRelative(filename, hostId)
  } else {
    return config.base + filename
  }
}
function getBaseInHTML(urlRelativePath: string, config: ResolvedConfig) {
  // Prefer explicit URL if defined for linking to assets and public files from HTML,
  // even when base relative is specified
  return config.base === './' || config.base === ''
    ? path.posix.join(
      path.posix.relative(urlRelativePath, '').slice(0, -2),
      './',
    )
    : config.base
}

function toAssetPathFromHtml(
  filename: string,
  htmlPath: string,
  config: ResolvedConfig,
): string {
  const relativeUrlPath = normalizePath(path.relative(config.root, htmlPath))
  const toRelative = (filePath: string, hostId: string) =>
    getBaseInHTML(relativeUrlPath, config) + filePath
  return toOutputFilePathInHtml({
    filename,
    type: 'asset',
    hostId: htmlPath,
    hostType: 'html',
    config,
    toRelative,
  })
}

const requestQuerySplitRE = /\?(?!.*[/|}])/

function parseRequestQuery(id: string): Record<string, string> | null {
  const search = id.split(requestQuerySplitRE, 2)[1]
  return search
    ? Object.fromEntries(new URLSearchParams(search))
    : null
}

export interface Options {
  prefetchLegacyChunks?: boolean,
}

const prefetchChunk = (options: Options = {}): Plugin => {
  const prefetchModules = new Set<string>()
  let config: ResolvedConfig
  return {
    name: 'vite-plugin-prefetch-chunk',
    resolveId: {
      order: 'pre',
      handler(id, importer) {
        if (id === 'virtual:prefetch') {
          if (importer) {
            prefetchModules.add(importer)
          }
          return '\0' + id
        }
        const query = parseRequestQuery(id)
        if (query && 'prefetch' in query) {
          prefetchModules.add(id)
        }
      },
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    load(id) {
      if (id === '\0virtual:prefetch') {
        return ''
      }
    },
    transformIndexHtml(html, { filename: htmlPath, bundle }) {
      if (!bundle) return html
      const chunks = Object.values(bundle).filter((chunk): chunk is Rollup.OutputChunk => {
        if (chunk.type !== 'chunk' || chunk.isEntry) return false
        if (!options.prefetchLegacyChunks && chunk.fileName.includes('-legacy')) return false
        return true
      })
      const prefetchFiles = new Set<{ href: string, as?: string }>()
      for (const chunk of chunks) {
        for (const id of Object.keys(chunk.modules)) {
          if (prefetchModules.has(id)) {
            prefetchFiles.add({
              href: toAssetPathFromHtml(chunk.fileName, htmlPath, config),
            })
            const importedCss: Set<string> | undefined = chunk['viteMetadata']?.importedCss
            if (importedCss) {
              for (const file of importedCss) {
                prefetchFiles.add({
                  href: toAssetPathFromHtml(file, htmlPath, config),
                  as: 'style',
                })
              }
            }
          }
        }
      }
      return {
        html,
        tags: Array.from(prefetchFiles, attrs => {
          return {
            tag: 'link',
            attrs: {
              rel: 'prefetch',
              ...attrs,
              crossorigin: true,
            },
            injectTo: 'head',
          }
        }),
      }
    },
  }
}

export default prefetchChunk
