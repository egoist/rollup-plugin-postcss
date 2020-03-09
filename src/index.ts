import Concat from 'concat-with-sourcemaps'
import path from 'path'
import type { Plugin } from 'rollup'
import { CreateFilter, createFilter } from 'rollup-pluginutils'

import { Loaders } from './Loader'
import { LoaderContext } from './type'
import { extracted, normalizePath } from './util'

type FunctionType<T = any, U = any> = (...args: T[]) => U;
// todo
type onExtract = (asset: {
  code: any
  map: any
  codeFileName: string
  mapFileName: string
}) => boolean

export type PostCSSPluginConf = {
  inject?: boolean | { [key: string]: any } | ((cssVariableName: string, id: string) => string)
  extract?: boolean | string
  onExtract?: onExtract
  modules?: boolean | { [key: string]: any }
  extensions?: string[]
  plugins?: any[]
  autoModules?: boolean
  namedExports?: boolean | ((id: string) => boolean)
  minimize?: boolean | any
  parser?: string | FunctionType
  stringifier?: string | FunctionType
  syntax?: string | FunctionType
  exec?: boolean
  config?: boolean | {
    path: string
    ctx: any
  };
  to?: string
  name?: any[] | any[][]
  loaders?: any[]
  onImport?: (id: string) => void
  use?: string[] | { [key in 'sass' | 'stylus' | 'less']: any }
  /**
   * @default: false
   **/
  sourceMap?: boolean | 'inline'
  filter?: {
    include?: Parameters<CreateFilter>[0]
    exclude?: Parameters<CreateFilter>[1]
    options?: Parameters<CreateFilter>[2]
  }
  /**
   * @deprecated use `filter.include` instead
   **/
  include?: Parameters<CreateFilter>[0]
  /**
   * @deprecated use `filter.exclude` instead
   **/
  exclude?: Parameters<CreateFilter>[1]
}

function inferOption<T, U> (option: undefined | null | T, defaultValue: U): T | U {
  if (typeof option === 'boolean' && option === false) return option
  else if (option && typeof option === 'object') return option
  else if (option == null) return defaultValue
  return {} as U
}

const noop = () => {}

export default function (options: PostCSSPluginConf = {}): Plugin {
  const filterConf = {
    ...options.filter,
    include: options.include,
    exclude: options.exclude
  }
  const postcssPlugins = Array.isArray(options.plugins)
    ? options.plugins.filter(Boolean)
    : undefined
  const filter = createFilter(filterConf.include, filterConf.exclude, filterConf.options)
  const sourceMap = options.sourceMap
  const onImport = typeof options.onImport === 'function' ? options.onImport : noop
  const postcssLoaderOptions = {
    /** Inject CSS as `<style>` to `<head>` */
    inject: typeof options.inject === 'function' ? options.inject : inferOption(options.inject, {}),
    /** Extract CSS */
    extract: typeof options.extract === 'undefined' ? false : options.extract,
    /** CSS modules */
    modules: inferOption(options.modules, false),
    namedExports: options.namedExports,
    /** Automatically CSS modules for .module.xxx files */
    autoModules: options.autoModules,
    /** Options for cssnano */
    minimize: inferOption(options.minimize, false),
    /** Postcss config file */
    config: inferOption(options.config, {}),
    /** PostCSS target filename hint, for plugins that are relying on it */
    to: options.to,
    /** PostCSS options */
    postcss: {
      parser: options.parser,
      plugins: postcssPlugins,
      syntax: options.syntax,
      stringifier: options.stringifier,
      exec: options.exec
    }
  }
  let use: (string | [string, object])[] = ['sass', 'stylus', 'less']
  if (Array.isArray(options.use)) {
    use = options.use
  } else if (options.use !== null && typeof options.use === 'object') {
    use = [
      ['sass', options.use.sass || {}],
      ['stylus', options.use.stylus || {}],
      ['less', options.use.less || {}]
    ]
  }
  use.unshift(['postcss', postcssLoaderOptions])
  const loaders = new Loaders({
    use: [...use],
    loaders: options.loaders || [],
    extensions: options.extensions || ['.css', '.sss', '.pcss']
  })

  return {
    name: 'postcss',

    async transform (code, id) {
      if (!filter(id) || !loaders.isSupport(id)) {
        return null
      }
      onImport(id)

      const loaderContext: LoaderContext = {
        id,
        sourceMap: sourceMap ?? new Map(),
        dependencies: new Set<string>(),
        rollup: this,
        options: {}
      }

      const res = await loaders.process({ code }, loaderContext)

      for (const dep of loaderContext.dependencies) {
        this.addWatchFile(dep)
      }

      if (options.extract) {
        return {
          code: res.code,
          // ???
          map: { mappings: '' } as { mappings: '' }
        }
      }
      return {
        code: res.code,
        map: res.map || { mappings: '' }
      }
    },

    augmentChunkHash () {
      if (extracted.size === 0) return
      const extractedValue = Array.from(extracted).reduce((obj, [key, value]) => ({
        ...obj,
        [key]: value
      }), {})
      return JSON.stringify(extractedValue)
    },

    async generateBundle (opts, bundle) {
      if (
        extracted.size === 0 ||
        !(opts.dir || opts.file)
      ) return

      // todo: support `[hash]`
      // @ts-ignore
      const dir = opts.dir || path.dirname(opts.file)
      const file =
        opts.file ||
        path.join(
          opts.dir ?? '',
          // fixme: isEntry not exist
          // @ts-ignore
          Object.keys(bundle).find(fileName => bundle[fileName].isEntry) ?? ''
        )
      const getExtracted = () => {
        const fileName =
          typeof postcssLoaderOptions.extract === 'string'
            ? normalizePath(path.relative(dir, postcssLoaderOptions.extract))
            : `${path.basename(file, path.extname(file))}.css`
        const concat = new Concat(true, fileName, '\n')
        const entries = Array.from(extracted.values())
        // fixme: modules not exist
        // @ts-ignore
        const { modules } = bundle[normalizePath(path.relative(dir, file))]

        if (modules) {
          const fileList = Object.keys(modules)
          entries.sort(
            (a, b) => fileList.indexOf(a.id) - fileList.indexOf(b.id)
          )
        }
        for (const res of entries) {
          const relative = normalizePath(path.relative(dir, res.id))
          const map = res.map || null
          if (map) {
            map.file = fileName
          }
          concat.add(relative, res.code, map)
        }
        let code = concat.content.toString()

        if (sourceMap === 'inline') {
          code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
            concat.sourceMap ?? '',
            'utf8'
          ).toString('base64')}*/`
        } else if (sourceMap === true) {
          code += `\n/*# sourceMappingURL=${fileName}.map */`
        }

        return {
          code,
          map: sourceMap === true && concat.sourceMap,
          codeFileName: fileName,
          mapFileName: fileName + '.map'
        }
      }

      if (options.onExtract) {
        const shouldExtract = await options.onExtract(getExtracted())
        if (shouldExtract === false) {
          return
        }
      }

      let { code, codeFileName, map, mapFileName } = getExtracted()
      // Perform cssnano on the extracted file
      if (postcssLoaderOptions.minimize) {
        const cssOpts = postcssLoaderOptions.minimize
        cssOpts.from = codeFileName
        if (sourceMap === 'inline') {
          cssOpts.map = { inline: true }
        } else if (sourceMap === true && map) {
          cssOpts.map = { prev: map }
          cssOpts.to = codeFileName
        }

        const result = await require('cssnano').process(code, cssOpts)
        code = result.css

        if (sourceMap === true && result.map && result.map.toString) {
          map = result.map.toString()
        }
      }
      this.emitFile({
        fileName: codeFileName,
        type: 'asset',
        source: code
      })
      if (map) {
        this.emitFile({
          fileName: mapFileName,
          type: 'asset',
          source: map
        })
      }
    }
  }
}
