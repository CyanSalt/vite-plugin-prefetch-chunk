import type { Plugin } from 'vite'

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
    load(id) {
      if (id === '\0virtual:prefetch') {
        return ''
      }
    },
    transformIndexHtml(html, { bundle }) {
      if (!bundle) return html
      const chunks = Object.values(bundle).filter(chunk => {
        if (chunk.type === 'chunk' && chunk.isEntry) return false
        if (!options.prefetchLegacyChunks && chunk.fileName.includes('-legacy')) return false
        return true
      })
      const prefetchFiles = new Set<{ href: string, as?: string }>()
      for (const chunk of chunks) {
        const renderedModules = chunk.type === 'chunk' ? chunk.modules : {}
        for (const id of Object.keys(renderedModules)) {
          if (prefetchModules.has(id)) {
            prefetchFiles.add({ href: chunk.fileName })
            const importedCss: Set<string> | undefined = chunk['viteMetadata']?.importedCss
            if (importedCss) {
              for (const url of importedCss) {
                prefetchFiles.add({ href: url, as: 'style' })
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
