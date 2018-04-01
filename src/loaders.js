import series from 'promise.series'
import postcssLoader from './postcss-loader'
import sassLoader from './sass-loader'
import stylusLoader from './stylus-loader'
import lessLoader from './less-loader'

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

    this.registerLoader(postcssLoader)
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
      return loader.test && loader.test.test(filepath)
    })
  }

  process({ code, map, id, sourceMap, scoped }) {
    return series(this.use.slice().reverse().map(([name, options]) => {
      const loader = this.getLoader(name)
      const loaderContext = {
        options: options || {},
        id,
        sourceMap,
        scoped
      }
      return v => {
        if (loader.alwaysProcess || loader.test.test(id)) {
          return loader.process.call(loaderContext, v)
        }
        // Otherwise directly return input value
        return v
      }
    }), { code, map })
  }

  getLoader(name) {
    return this.loaders.find(loader => loader.name === name)
  }
}
