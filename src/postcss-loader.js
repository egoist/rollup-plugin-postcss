import path from 'path'
import postcss from 'postcss'

export default {
  name: 'postcss',
  test: /\.css$/,
  async process({ code, map }) {

    const options = this.options || {}
    const plugins = options.plugins || []
    const processOpts = {
      from: path.relative(process.cwd(), this.id),
      to: path.relative(process.cwd(), this.id),
      map: {
        inline: false,
        annotation: false
      }
    }
    const res = await postcss(plugins).process(code, processOpts)

    return {
      code: res.css,
      map: res.map.toString()
    }
  }
}
