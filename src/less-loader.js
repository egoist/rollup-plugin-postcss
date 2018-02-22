import pify from 'pify'
import { localRequire } from './utils'

export default {
  name: 'less',
  test: /\.less$/,
  async process({ code }) {
    const less = localRequire('less')

    const { css, map } = await pify(less.render.bind(less))(code, {
      sourceMap: this.sourceMap && {},
      filename: this.id
    })

    return {
      code: css,
      map
    }
  }
}
