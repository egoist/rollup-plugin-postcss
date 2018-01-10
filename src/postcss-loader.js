import path from 'path'
import postcss from 'postcss'

export default {
  name: 'postcss',
  test: /\.css$/,
  async process({ code, map }) {
    const options = this.options
    const plugins = options.plugins || []

    let modulesExported = {}
    if (options.modules) {
      const modulesOpts =
        typeof options.module === 'object' ? options.module : {}
      modulesOpts.getJSON = (filepath, json) => {
        modulesExported[filepath] = json
      }
      plugins.unshift(require('postcss-modules')(modulesOpts))
    }

    if (options.minimize) {
      const cssnanoOpts =
        typeof options.minimize === 'object' ? options.minimize : {}
      plugins.push(require('cssnano')(cssnanoOpts))
    }

    const postcssOpts = {
      from: path.relative(process.cwd(), this.id),
      to: path.relative(process.cwd(), this.id),
      map: {
        inline: false,
        annotation: false
      }
    }

    const res = await postcss(plugins).process(code, postcssOpts)

    const shouldExtract = options.extract
    const shouldInject = options.inject
    let output = ''
    let extracted
    if (shouldExtract) {
      output += `export default ${JSON.stringify(modulesExported[this.id])};`
      extracted = {
        id: this.id,
        code: res.css,
        map: res.map
      }
    } else {
      output += `var css = ${JSON.stringify(res.css)};\nexport default ${
        options.modules ? JSON.stringify(modulesExported[this.id]) : 'css'
      };`
    }
    if (!shouldExtract && shouldInject) {
      output += '\n__$$styleInject(css);'
    }

    return {
      code: output,
      map: res.map,
      extracted
    }
  }
}
