import path from 'path'
import { createFilter } from 'rollup-pluginutils'
import Concat from 'concat-with-sourcemaps'
import Loaders from './loaders'
import normalizePath from './utils/normalize-path'

/**
 * The options that could be `boolean` or `object`
 * We convert it to an object when it's truthy
 * Otherwise fallback to default value
 */
function inferOption(option, defaultValue) {
  if (option === false) return false
  if (option && typeof option === 'object') return option
  return option ? {} : defaultValue
}

export default (options = {}) => {
  const filter = createFilter(options.include, options.exclude)
  const postcssPlugins = Array.isArray(options.plugins) ?
    options.plugins.filter(Boolean) :
    options.plugins
  const { sourceMap } = options
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
  let use = ['sass', 'stylus', 'less']
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
    use,
    loaders: options.loaders,
    extensions: options.extensions
  })

  const extracted = new Map()
  const importerMap = Object.create(null)

  return {
    name: 'postcss',

    async transform(code, id) {
      if (!filter(id) || !loaders.isSupported(id)) {
        return null
      }

      if (typeof options.onImport === 'function') {
        options.onImport(id)
      }

      const loaderContext = {
        id,
        sourceMap,
        dependencies: new Set(),
        warn: this.warn.bind(this),
        plugin: this
      }

      const result = await loaders.process(
        {
          code,
          map: undefined
        },
        loaderContext
      )

      for (const dep of loaderContext.dependencies) {
        this.addWatchFile(dep)
      }

      if (postcssLoaderOptions.extract) {
        extracted.set(id, result.extracted)
        return {
          code: result.code,
          map: { mappings: '' }
        }
      }

      return {
        code: result.code,
        map: result.map || { mappings: '' }
      }
    },

    augmentChunkHash() {
      if (extracted.size === 0) return
      const extractedValue = [...extracted].reduce((object, [key, value]) => ({
        ...object,
        [key]: value
      }), {})
      return JSON.stringify(extractedValue)
    },

    resolveId(importee, importer) {
      if (filter(importee) || loaders.isSupported(importee)) {
        importer || (importer = importee)
        const set = importerMap[importer] || new Set()
        set.add(path.resolve(path.dirname(importer), importee))

        if (!importerMap[importer]) {
          Object.assign(importerMap, {
            [importer]: set
          })
        }
      }

      return null
    },

    async generateBundle(options_, bundle) {
      if (
        extracted.size === 0 ||
        !(options_.dir || options_.file)
      ) return

      // TODO: support `[hash]`
      const dir = options_.dir || path.dirname(options_.file)
      const selectEntry = id => Object.keys(bundle).find(chunkId => {
        if (
          bundle[chunkId].facadeModuleId === id ||
          Object.keys(bundle[chunkId].modules).includes(id)) {
          if (bundle[chunkId].isEntry) {
            return chunkId
          }

          return selectEntry(bundle[chunkId].facadeModuleId)
        }

        return null
      })

      const getExtracted = () => {
        const assets = Object.create(null)
        // const entries = [...extracted.values()]

        for (const importer of Object.keys(importerMap)) {
          const entry = selectEntry(importer)

          for (const id of importerMap[importer]) {
            const result = extracted.get(id)
            if (!result) {
              continue
            }

            let fileName = path.join(path.dirname(entry), `${path.basename(entry, path.extname(entry))}.css`)

            if (typeof postcssLoaderOptions.extract === 'string') {
              if (path.isAbsolute(postcssLoaderOptions.extract)) {
                fileName = normalizePath(path.relative(dir, postcssLoaderOptions.extract))
              } else {
                fileName = normalizePath(postcssLoaderOptions.extract)
              }
            }

            const concat = assets[fileName] || new Concat(true, fileName, '\n')
            if (!assets[fileName]) {
              Object.assign(assets, { [fileName]: concat })
            }

            const relative = normalizePath(path.relative(dir, result.id))
            const map = result.map || null
            if (map) {
              map.file = fileName
            }

            concat.add(relative, result.code, map)
          }
        }

        return Object.keys(assets).map(asset => {
          const concated = assets[asset]
          let code = concated.content

          if (sourceMap === 'inline') {
            code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
              concated.sourceMap,
              'utf8'
            ).toString('base64')}*/`
          } else if (sourceMap === true) {
            code += `\n/*# sourceMappingURL=${asset}.map */`
          }

          return {
            code,
            map: sourceMap === true && concated.sourceMap,
            codeFileName: asset,
            mapFileName: `${asset}.map`
          }
        })
      }

      const bundleAsset = async asset => {
        if (options.onExtract) {
          const shouldExtract = await options.onExtract(() => asset)
          if (shouldExtract === false) {
            return
          }
        }

        let { code, codeFileName, map, mapFileName } = asset
        // Perform cssnano on the extracted file
        if (postcssLoaderOptions.minimize) {
          const cssOptions = postcssLoaderOptions.minimize
          cssOptions.from = codeFileName
          if (sourceMap === 'inline') {
            cssOptions.map = { inline: true }
          } else if (sourceMap === true && map) {
            cssOptions.map = { prev: map }
            cssOptions.to = codeFileName
          }

          const result = await require('cssnano').process(code, cssOptions)
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

      await Promise.all(getExtracted().map(chunk => bundleAsset(chunk)))
    }
  }
}
