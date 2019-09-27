import importCwd from 'import-cwd'
import pify from 'pify'
import humanlizePath from './utils/humanlize-path'

export default {
  name: 'less',
  test: /\.less$/,
  async process({ code }) {
    const { lessInstance, ...options } = this.options
    const less = lessInstance || importCwd('less')

    if (!less) {
      throw new Error(`You need to install less or provide a less compiler in order to process less files`)
    }

    let { css, map, imports } = await pify(less.render.bind(less))(code, {
      ...options,
      sourceMap: this.sourceMap && {},
      filename: this.id
    })

    for (const dep of imports) {
      this.dependencies.add(dep)
    }

    if (map) {
      map = JSON.parse(map)
      map.sources = map.sources.map(source => humanlizePath(source))
    }

    return {
      code: css,
      map
    }
  }
}
