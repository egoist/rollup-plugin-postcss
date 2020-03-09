import pify from 'pify'
import Stylus from 'stylus'

import { Loader } from '../../type'
import { loadModule } from '../../util'

const stylusLoader: Loader = {
  name: 'stylus',
  always: false,
  async process ({ code }, context) {
    const stylus = loadModule('stylus') as typeof Stylus
    if (!stylus) {
      throw new Error('You need to install "stylus" packages in order to process Stylus files')
    }

    const style = stylus(code, {
      ...context.options,
      filename: context.id,
      sourcemap: context.sourceMap && {}
    })

    const css = await pify(style.render.bind(style))()
    const deps = style.deps(context.id)
    for (const dep of deps) {
      context.dependencies.add(dep)
    }

    return {
      code: css,
      // @ts-ignore
      map: style.sourcemap
    }
  },
  test (id) {
    return /\.(styl|stylus)$/.test(id)
  }
}

export default stylusLoader
