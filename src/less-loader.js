import pify from 'pify'
import { localRequire } from './utils'

export default {
  name: 'less',
  test: /\.less$/,
  async process({ code }) {
    const less = localRequire('less')

    const { css, map } = await pify(less.render.bind(less))(code, {
      sourceMap: this.sourceMap && {}
    })

    return {
      code: css,
      map
    }
  }
}
