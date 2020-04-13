import path from 'path'
import series from 'promise.series'
import postcssLoader from './postcss-loader'
import sassLoader from './sass-loader'
import stylusLoader from './stylus-loader'
import lessLoader from './less-loader'

const matchFile = (filepath, condition) => {
  if (typeof condition === 'function') {
    return condition(filepath)
  }

  return condition && condition.test(filepath)
}

export default class Loaders {
  constructor(options = {}) {
    this.use = options.use.map(rule => {
      if (typeof rule === 'string') {
        return [rule]
      }

      if (Array.isArray(rule)) {
        return rule
      }

      throw new TypeError('The rule in `use` option must be string or Array!')
    })
    this.loaders = []

    const extensions = options.extensions || ['.css', '.sss', '.pcss']
    const customPostcssLoader = {
      ...postcssLoader,
      test: filepath => extensions.some(ext => path.extname(filepath) === ext)
    }
    this.registerLoader(customPostcssLoader)
    this.registerLoader(sassLoader)
    this.registerLoader(stylusLoader)
    this.registerLoader(lessLoader)
    if (options.loaders) {
      options.loaders.forEach(loader => this.registerLoader(loader))
    }
  }

  registerLoader(loader) {
    const existing = this.getLoader(loader.name)
    if (existing) {
      this.removeLoader(loader.name)
    }

    this.loaders.push(loader)
    return this
  }

  removeLoader(name) {
    this.loaders = this.loaders.filter(loader => loader.name !== name)
    return this
  }

  isSupported(filepath) {
    return this.loaders.some(loader => {
      return matchFile(filepath, loader.test)
    })
  }

  /**
   * Process the resource with loaders in serial
   * @param {object} resource
   * @param {string} resource.code
   * @param {any} resource.map
   * @param {object} context
   * @param {string} context.id The absolute path to resource
   * @param {boolean | 'inline'} context.sourceMap
   * @param {Set<string>} context.dependencies A set of dependencies to watch
   * @returns {{code: string, map?: any}}
   */
  process({ code, map }, context) {
    return series(
      this.use
        .slice()
        .reverse()
        .map(([name, options]) => {
          const loader = this.getLoader(name)
          const loaderContext = {
            options: options || {},
            ...context
          }

          return v => {
            if (
              loader.alwaysProcess ||
              matchFile(loaderContext.id, loader.test)
            ) {
              return loader.process.call(loaderContext, v)
            }

            // Otherwise directly return input value
            return v
          }
        }),
      { code, map }
    )
  }

  getLoader(name) {
    return this.loaders.find(loader => loader.name === name)
  }
}
