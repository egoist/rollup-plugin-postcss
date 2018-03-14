import importCwd from 'import-cwd'
import pify from 'pify'

export default {
  name: 'stylus',
  test: /\.(styl|stylus)$/,
  async process({ code }) {
    const stylus = importCwd('stylus')

    const style = stylus(code, {
      ...this.options,
      filename: this.id,
      sourcemap: this.sourceMap && {}
    })

    const css = await pify(style.render.bind(style))()

    return {
      code: css,
      map: style.sourcemap
    }
  }
}
