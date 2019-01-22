import path from 'path'
import { createFilter } from 'rollup-pluginutils'
import Concat from 'concat-with-sourcemaps'
import Loaders from './loaders'

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
  const sourceMap = options.sourceMap
  const postcssLoaderOptions = {
    /** Inject CSS as `<style>` to `<head>` */
    inject: inferOption(options.inject, {}),
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
    /** PostCSS options */
    postcss: {
      parser: options.parser,
      plugins: options.plugins,
      syntax: options.syntax,
      stringifier: options.stringifier,
      exec: options.exec
    }
  }
  const use = options.use || ['sass', 'stylus', 'less']
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

      const res = await loaders.process({
        code,
        map: undefined,
        id,
        sourceMap
      })

      if (postcssLoaderOptions.extract) {
        extracted.set(id, res.extracted)
        return {
          code: res.code,
          map: { mappings: '' }
        }
      }

      return {
        code: res.code,
        map: res.map || { mappings: '' }
      }
    },

    async generateBundle(opts, bundle) {
      if (extracted.size === 0) return

      const dir = opts.dir || path.dirname(opts.file)
      const getExtracted = () => {
        const fileName =
          typeof postcssLoaderOptions.extract === 'string' ?
            path.relative(dir, postcssLoaderOptions.extract) :
            `${path.basename(opts.file, path.extname(opts.file))}.css`
        const concat = new Concat(true, fileName, '\n')
        for (const res of extracted.values()) {
          const relative = path.relative(dir, res.id)
          const map = res.map || null
          if (map) {
            map.file = fileName
          }
          concat.add(relative, res.code, map)
        }
        let code = concat.content

        if (sourceMap === 'inline') {
          code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
            concat.sourceMap,
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
        const shouldExtract = await options.onExtract(getExtracted)
        if (shouldExtract === false) {
          return
        }
      }

      const { code, codeFileName, map, mapFileName } = getExtracted()
      const codeFile = {
        fileName: codeFileName,
        isAsset: true,
        source: code
      }
      bundle[codeFile.fileName] = codeFile
      if (map) {
        const mapFile = {
          fileName: mapFileName,
          isAsset: true,
          source: map
        }
        bundle[mapFile.fileName] = mapFile
      }
    }
  }
}
