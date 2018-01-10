import path from 'path'
import fs from 'fs-extra'
import { createFilter } from 'rollup-pluginutils'
import Loaders from './loaders'
import styleInject from 'style-inject'
import Concat from 'concat-with-sourcemaps'

export default (options = {}) => {
  const filter = createFilter(options.include, options.exclude)

  const postcssLoaderOptions = {
    /** Inject CSS as `<style>` to `<head>` */
    inject: typeof options.inject === 'undefined' ? {} : options.inject,
    /** Extract CSS */
    extract: options.extract,
    /** CSS modules */
    modules: options.modules,
    /** Options for cssnano */
    minimize: options.minimize
  }
  let use = options.use || []
  use.unshift([
    'postcss',
    postcssLoaderOptions
  ])
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
      return styleInject.toString().replace('styleInject', '__$$styleInject')
    },

    async transform(code, id) {
      if (!filter(id) || !loaders.isSupported(id)) {
        return null
      }

      const res = await loaders.process({
        code,
        map: undefined,
        id
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
        map: JSON.parse(res.map.toString())
      }
    },

    async onwrite(opts) {
      if (extracted.length === 0) return

      const basename = path.basename(opts.file, path.extname(opts.file))
      const file = path.relative(process.cwd(), path.join(
        path.dirname(opts.file),
        basename + '.css'
      ))
      const concat = new Concat(true, file, '\n')
      for (const res of extracted) {
        const relative = path.relative(process.cwd(), res.id)
        concat.add(relative, res.code, JSON.parse(res.map.toString()))
      }
      const code = concat.content + `\n/*# sourceMappingURL=${basename}.css.map */`

      await Promise.all([
        fs.writeFile(file, code, 'utf8'),
        fs.writeFile(file + '.map', concat.sourceMap, 'utf8')
      ])

      // Release for potential next build
      extracted = []
    }
  }
}
