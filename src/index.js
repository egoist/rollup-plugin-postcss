import path from 'path'
import { createFilter } from 'rollup-pluginutils'
import Loaders from './loaders'
import styleInject from 'style-inject'
import fs from 'fs-extra'
import Concat from 'concat-with-sourcemaps'

const EXT = ['.css', '.styl', '.sass', '.scss', '.less']

export default (options = {}) => {
  const filter = createFilter(options.include, options.exclude)

  const inject = typeof options.inject === 'undefined' ? {} : options.inject

  let use = options.use || ['css', 'postcss']
  use = use.reduce((res, rule) => {
    if (typeof rule === 'string') {
      rule = [rule]
    }
    const name = rule[0]
    const options = rule[1] || {}

    if (name === 'css') {
      if (typeof options.inject === 'undefined') {
        options.inject = true
      }
    }

    res[name] = options
    return res
  }, {})
  const loaders = new Loaders({
    use
  })

  const extracted = []

  return {
    name: 'postcss',

    intro() {
      if (!use.css.inject || use.css.extract) return
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

      if (use.css.extract) {
        extracted.push(res.extracted)
        return {
          code: res.code,
          map: { mappings: '' }
        }
      }

      return {
        code: res.code,
        map: res.map
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
        concat.add(relative, res.code, res.map)
      }
      const code = concat.content + `\n/*# sourceMappingURL=${basename}.css.map */`
      await Promise.all([
        fs.writeFile(file, code, 'utf8'),
        fs.writeFile(file + '.map', concat.sourceMap, 'utf8')
      ])
    }
  }
}
