import series from 'promise.series'
import postcssLoader from './postcss-loader'
import sassLoader from './sass-loader'

export default class Loaders {
  constructor(options = {}) {
    this.use = options.use
    this.loaders = []

    this.registerLoader(postcssLoader)
    this.registerLoader(sassLoader)
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
      return loader.test.test(filepath)
    })
  }

  process({ code, map, id, sourceMap }) {
    const names = Object.keys(this.use)
    return series(names.slice().reverse().map(name => {
      const loader = this.getLoader(name)
      const options = this.use[name]
      const loaderContext = {
        options,
        id,
        sourceMap
      }
      return v => loader.process.call(loaderContext, v)
    }), { code, map })
  }

  getLoader(name) {
    return this.loaders.find(loader => loader.name === name)
  }
}
