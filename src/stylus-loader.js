import importCwd from 'import-cwd'
import pify from 'pify'

export default {
  name: 'stylus',
  test: /\.(styl|stylus)$/,
  async process({ code }) {
    const { stylusInstance, ...options } = this.options
    const stylus = stylusInstance || importCwd('stylus')

    if (!stylus) {
      throw new Error(`You need to install stylus or provide a compiler in order to process stylus files`)
    }

    const style = stylus(code, {
      ...options,
      filename: this.id,
      sourcemap: this.sourceMap && {}
    })

    const css = await pify(style.render.bind(style))()
    const deps = style.deps()
    for (const dep of deps) {
      this.dependencies.add(dep)
    }

    return {
      code: css,
      map: style.sourcemap
    }
  }
}
