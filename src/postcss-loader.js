import path from 'path'
import postcss from 'postcss'

export default {
  name: 'postcss',
  test: /\.css$/,
  async process({ code, map }) {
    const options = this.options
    const plugins = options.plugins || []

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
      output += `export default {};`
      extracted = {
        id: this.id,
        code: res.css,
        map: res.map
      }
    } else {
      output += `var css = ${JSON.stringify(res.css)};\nexport default css;`
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
