import { extname } from 'path'
import { SourceDescription } from 'rollup'

import { PostCSSPluginConf } from '../index'
import { Loader, LoaderContext } from '../type'
import { series } from '../util'
import lessLoader from './LoaderPlugins/lessLoader'
import sassLoader from './LoaderPlugins/sassLoader'
import stylusLoader from './LoaderPlugins/stylusLoader'
import { PostcssLoader } from './PostcssLoader'

const matchFile = (filepath: string, condition: Function | RegExp) => {
  if (typeof condition === 'function') {
    return condition(filepath)
  }
  return condition && condition.test(filepath)
}

export class Loaders {
  use: [string, object][] = []
  loaders: Loader[] = []
  postcssLoader: PostcssLoader

  constructor (options: {
    use: (string | [string, object])[]
    extensions: Exclude<PostCSSPluginConf['extensions'], undefined | null>
    loaders: Exclude<PostCSSPluginConf['loaders'], undefined | null>
  }) {
    this.use = options.use.map(rule => {
      if (typeof rule === 'string') {
        return [rule, {}]
      }
      if (Array.isArray(rule)) {
        return rule
      }
      throw new TypeError('The rule in `use` option must be string or Array')
    })
    const extensions = options.extensions
    this.postcssLoader = new PostcssLoader()
    this.postcssLoader.test = (filepath: string) => extensions.some(ext => extname(filepath) === ext)
    this.registerPlugin([this.postcssLoader, lessLoader, sassLoader, stylusLoader])
    this.registerPlugin(options.loaders)
  }

  registerPlugin (loaders: any | any[]): void {
    if (Array.isArray(loaders)) {
      loaders.forEach(loader => this.registerPlugin(loader))
    } else {
      const loader = loaders
      const exist = this.loaders.find(_loader => _loader.name === loader.name)
      if (exist) {
        return
      }
      this.loaders.push(loader)
    }
  }

  async process (source: SourceDescription, context: LoaderContext): Promise<SourceDescription> {
    return series(
      this.use
        .slice()
        .reverse()
        .map(([name, options]) => {
          const loader = this.loaders.find(loader => loader.name === name)
          if (loader == null) {
            return source
          }
          const loaderContext: LoaderContext = {
            ...context,
            options: options
          }
          return (source: SourceDescription) => {
            if (
              loader.always ||
              matchFile(name, loader.test)
            ) {
              return loader.process(source, loaderContext)
            }
            // Otherwise directly return input value
            return source
          }
        }),
      source
    )
  }

  isSupport (id: string): boolean {
    return this.loaders.some(loader => {
      return matchFile(id, loader.test)
    })
  }
}

export { PostcssLoader } from './PostcssLoader'
