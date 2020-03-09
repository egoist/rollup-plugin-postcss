import Less from 'less'
import pify from 'pify'
import { SourceDescription } from 'rollup'

import { Loader } from '../../type'
import { humanlizePath, loadModule } from '../../util'

const lessLoader: Loader = {
  name: 'less',
  always: false,
  async process (source, context): Promise<SourceDescription> {
    const less: LessStatic = loadModule('less')
    let { css, map, imports } = await pify(less.render.bind(less))(source.code, {
      ...context.options,
      sourceMap: context.sourceMap && {},
      filename: context.id
    }) as Less.RenderOutput
    for (const dep of imports) {
      context.dependencies.add(dep)
    }
    if (map) {
      map = JSON.parse(map);
      (map as any).sources = (map as any).sources.map((source: string) => humanlizePath(source))
    }

    return {
      code: css,
      map
    }
  },
  test (id) {
    return /\.less$/.test(id)
  }
}

export default lessLoader
