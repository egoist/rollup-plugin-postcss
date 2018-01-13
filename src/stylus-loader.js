import pify from 'pify'
import { localRequire } from './utils'

export default {
  name: 'stylus',
  test: /\.(styl|stylus)$/,
  async process({ code }) {
    const stylus = localRequire('stylus')

    const style = stylus(code)
      .set('filename', this.id)
      .set('sourcemap', this.sourceMap && {})

    const css = await pify(style.render.bind(style))()
    return {
      code: css,
      map: style.sourcemap
    }
  }
}
