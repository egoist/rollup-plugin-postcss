import pify from 'pify'
import normalizePath from './utils/normalize-path'
import localRequire from './utils/local-require'

export default {
  name: 'less',
  test: /\.less$/,
  async process({ code }) {
    const less = localRequire('less')

    let { css, map } = await pify(less.render.bind(less))(code, {
      ...this.options,
      sourceMap: this.sourceMap && {},
      filename: this.id
    })

    if (map) {
      map = JSON.parse(map)
      map.sources = map.sources.map(source => normalizePath(source))
    }

    return {
      code: css,
      map
    }
  }
}
