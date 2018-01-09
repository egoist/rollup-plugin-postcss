import path from 'path'
import postcss from 'postcss'
import series from 'promise.series'
import cssLoader from './css-loader'
import postcssLoader from './postcss-loader'

export default class Loaders {
  constructor(options = {}) {
    this.use = options.use
    this.loaders = []

    this.registerLoader(cssLoader)
    this.registerLoader(postcssLoader)
  }

  registerLoader(loader) {
    this.loaders.push(loader)
    return this
  }

  isSupported(filepath) {
    return this.loaders.some(loader => {
      return loader.test.test(filepath)
    })
  }

  process({ code, map, id }) {
    const names = Object.keys(this.use)
    return series(names.slice().reverse().map(name => {
      const loader = this.getLoader(name)
      const options = this.use[name]
      const loaderContext = {
        options,
        id
      }
      return v => loader.process.call(loaderContext, v)
    }), { code, map })
  }

  getLoader(name) {
    return this.loaders.find(loader => loader.name === name)
  }
}

function localRequire(name) {
  return require(process.resolve('node_modules', name))
}
