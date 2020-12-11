import path from 'path'
import fs from 'fs'
import pify from 'pify'
import { loadModule } from './utils/load-module'

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */
export default {
  name: 'stylus',
  test: /\.(styl|stylus)$/,
  async process({ code }) {
    const stylus = loadModule('stylus')
    if (!stylus) {
      throw new Error('You need to install "stylus" packages in order to process Stylus files')
    }

    const style = stylus(code, {
      ...this.options,
      filename: this.id,
      sourcemap: this.sourceMap && {
        comment: false
      }
    })

    const css = await pify(style.render.bind(style))()

    if (style.sourcemap && style.sourcemap.sources) {
      const sourcesContent = await Promise.all(style.sourcemap.sources.map(async file => {
        const absPath = path.resolve(file)
        const source = await pify(fs.readFile)(absPath, 'utf8')
        return source.toString()
      }))
      style.sourcemap.sourcesContent = sourcesContent
    }

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
