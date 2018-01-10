import pify from 'pify'
import { localRequire } from './utils'

export default {
  name: 'sass',
  test: /\.s[ac]ss$/,
  async process({ code }) {
    const sass = localRequire('node-sass')
    const res = await pify(sass.render.bind(sass))({
      ...this.options,
      file: this.id,
      data: code,
      indentedSyntax: /\.sass$/.test(this.id),
      sourceMap: this.sourceMap
    })

    return {
      code: res.css.toString(),
      map: res.map && res.map.toString()
    }
  }
}
