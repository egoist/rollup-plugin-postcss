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

/**
 * Recursively get the correct import order from rollup
 * We only process a file once
 *
 * @param {string} id
 * @param {Function} getModuleInfo
 * @param {Set<string>} seen
 */
function getRecursiveImportOrder(id, getModuleInfo, seen = new Set()) {
  if (seen.has(id)) {
    return []
  }

  seen.add(id)

  const result = [id]
  getModuleInfo(id).importedIds.forEach(importFile => {
    result.push(...getRecursiveImportOrder(importFile, getModuleInfo, seen))
  })

  return result
}

/* eslint import/no-anonymous-default-export: [2, {"allowArrowFunction": true}] */
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
    onlyModules: options.modules === true,
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
      // eslint-disable-next-line unicorn/no-reduce
      const extractedValue = [...extracted].reduce((object, [key, value]) => ({
        ...object,
        [key]: value
      }), {})
      return JSON.stringify(extractedValue)
    },

    async generateBundle(options_, bundle) {
      if (
        extracted.size === 0 ||
        !(options_.dir || options_.file)
      ) return

      // eslint-disable-next-line no-warning-comments
      // TODO: support `[hash]`
      const dir = options_.dir || path.dirname(options_.file)
      const file =
        options_.file ||
        path.join(
          options_.dir,
          Object.keys(bundle).find(fileName => bundle[fileName].isEntry)
        )
      const getExtracted = () => {
        let fileName = `${path.basename(file, path.extname(file))}.css`
        if (typeof postcssLoaderOptions.extract === 'string') {
          fileName = path.isAbsolute(postcssLoaderOptions.extract) ? normalizePath(path.relative(dir, postcssLoaderOptions.extract)) : normalizePath(postcssLoaderOptions.extract)
        }

        const concat = new Concat(true, fileName, '\n')
        const entries = [...extracted.values()]
        const { modules, facadeModuleId } = bundle[
          normalizePath(path.relative(dir, file))
        ]

        if (modules) {
          const moduleIds = getRecursiveImportOrder(
            facadeModuleId,
            this.getModuleInfo
          )
          entries.sort(
            (a, b) => moduleIds.indexOf(a.id) - moduleIds.indexOf(b.id)
          )
        }

        for (const result of entries) {
          const relative = normalizePath(path.relative(dir, result.id))
          const map = result.map || null
          if (map) {
            map.file = fileName
          }

          concat.add(relative, result.code, map)
        }

        let code = concat.content

        if (sourceMap === 'inline') {
          code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
            concat.sourceMap,
            'utf8'
          ).toString('base64')}*/`
        } else if (sourceMap === true) {
          code += `\n/*# sourceMappingURL=${path.basename(fileName)}.map */`
        }

        return {
          code,
          map: sourceMap === true && concat.sourceMap,
          codeFileName: fileName,
          mapFileName: fileName + '.map'
        }
      }

      if (options.onExtract) {
        const shouldExtract = await options.onExtract(getExtracted)
        if (shouldExtract === false) {
          return
        }
      }

      let { code, codeFileName, map, mapFileName } = getExtracted()
      // Perform cssnano on the extracted file
      if (postcssLoaderOptions.minimize) {
        const cssOptions = {}
        cssOptions.from = codeFileName
        if (sourceMap === 'inline') {
          cssOptions.map = { inline: true }
        } else if (sourceMap === true && map) {
          cssOptions.map = { prev: map }
          cssOptions.to = codeFileName
        }

        const result = await require('cssnano')(postcssLoaderOptions.minimize).process(code, cssOptions)
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
