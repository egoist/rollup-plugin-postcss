import path from 'path'
import fs from 'fs-extra'
import { createFilter } from 'rollup-pluginutils'
import styleInject from 'style-inject'
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
  let use = options.use || ['sass', 'stylus', 'less']
  use.unshift(['postcss', postcssLoaderOptions])
  use = use.reduce((res, rule) => {
    if (typeof rule === 'string') {
      rule = [rule]
    }
    const name = rule[0]
    const options = rule[1] || {}

    res[name] = options
    return res
  }, {})

  const loaders = new Loaders({
    use,
    loaders: options.loaders
  })

  let extracted = []

  return {
    name: 'postcss',

    intro() {
      if (!postcssLoaderOptions.inject || postcssLoaderOptions.extract) return
      return styleInject.toString().replace('styleInject', '__$$$$styleInject')
    },

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
        extracted.push(res.extracted)
        return {
          code: res.code,
          map: { mappings: '' }
        }
      }

      return {
        code: res.code,
        map: res.map ? JSON.parse(res.map.toString()) : { mappings: '' }
      }
    },

    async onwrite(opts) {
      if (extracted.length === 0) return

      const basename = path.basename(opts.file, path.extname(opts.file))
      const file = path.relative(
        process.cwd(),
        path.join(path.dirname(opts.file), basename + '.css')
      )
      const concat = new Concat(true, file, '\n')
      for (const res of extracted) {
        const relative = path.relative(process.cwd(), res.id)
        const map = res.map ? JSON.parse(res.map.toString()) : null
        if (map) {
          map.file = file
          map.sources = map.sources.map(source =>
            path.relative(
              process.cwd(),
              path.join(path.dirname(opts.file), source)
            )
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
        code += `\n/*# sourceMappingURL=${basename}.css.map */`
      }

      await Promise.all([
        fs.writeFile(file, code, 'utf8'),
        sourceMap === true &&
          fs.writeFile(file + '.map', concat.sourceMap, 'utf8')
      ])

      // Release for potential next build
      extracted = []
    }
  }
}
