import path from 'path'
import queryString from 'querystring'
import fs from 'fs-extra'
import { createFilter } from 'rollup-pluginutils'
import Concat from 'concat-with-sourcemaps'
import Loaders from './loaders'
import humanlizePath from './utils/humanlize-path'

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

const QUERY_REGEXP = /\?(.+)$/

function hasQuery(str) {
  return QUERY_REGEXP.test(str)
}

function parseQuery(str) {
  return queryString.parse(QUERY_REGEXP.exec(str)[1])
}

function stripQuery(str) {
  return str.replace(QUERY_REGEXP, '')
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
    autoModulesPattern: options.autoModulesPattern,
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

    resolveId(id, importer) {
      if (importer && hasQuery(id)) {
        return path.resolve(path.dirname(importer), id)
      }
    },

    async load(id) {
      if (hasQuery(id)) {
        const { start, end, file } = parseQuery(id)
        const bareId = stripQuery(id)
        const content = await fs.readFile(
          file ? path.resolve(path.dirname(bareId), file) : bareId,
          'utf8'
        )
        return start && end ?
          content.slice(Number(start), Number(end)) :
          content
      }
    },

    async transform(code, id) {
      let scoped
      if (hasQuery(id)) {
        const query = parseQuery(id)
        scoped = query.scoped
        id = stripQuery(id)
      }

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
        sourceMap,
        scoped
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

    async onwrite(opts) {
      if (extracted.size === 0) return

      const getExtracted = filepath => {
        if (!filepath) {
          if (typeof postcssLoaderOptions.extract === 'string') {
            filepath = postcssLoaderOptions.extract
          } else {
            const basename = path.basename(opts.file, path.extname(opts.file))
            filepath = path.join(path.dirname(opts.file), basename + '.css')
          }
        }
        filepath = humanlizePath(filepath)
        const concat = new Concat(true, filepath, '\n')
        for (const res of extracted.values()) {
          const relative = humanlizePath(res.id)
          const map = res.map || null
          if (map) {
            map.file = filepath
            map.sources = map.sources.map(source =>
              humanlizePath(path.join(path.dirname(opts.file), source))
            )
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
          code += `\n/*# sourceMappingURL=${path.basename(filepath)}.map */`
        }

        return {
          code,
          map: sourceMap === true && concat.sourceMap,
          codeFilePath: filepath,
          mapFilePath: filepath + '.map'
        }
      }

      if (options.onExtract) {
        const shouldExtract = await options.onExtract(getExtracted)
        if (shouldExtract === false) {
          return
        }
      }

      const { code, codeFilePath, map, mapFilePath } = getExtracted()
      await fs
        .ensureDir(path.dirname(codeFilePath))
        .then(() =>
          Promise.all([
            fs.writeFile(codeFilePath, code, 'utf8'),
            sourceMap === true && fs.writeFile(mapFilePath, map, 'utf8')
          ])
        )
    }
  }
}
