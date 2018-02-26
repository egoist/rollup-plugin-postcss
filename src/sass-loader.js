import path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import localRequire from './utils/local-require'

const moduleRe = /^~([a-z0-9]|@).+/i

export default {
  name: 'sass',
  test: /\.s[ac]ss$/,
  async process({ code }) {
    const sass = localRequire('node-sass')
    const res = await pify(sass.render.bind(sass))({
      ...this.options,
      file: this.id,
      data: code,
      indentedSyntax: /\.sass$/.test(this.id),
      sourceMap: this.sourceMap,
      importer: [(url, prev, done) => {
        if (!moduleRe.test(url)) return done({ file: prev })

        resolve(url.slice(1), {
          basedir: path.dirname(this.id),
          extensions: ['.sass', '.scss', '.css']
        }, (err, id) => {
          if (err) {
            return Promise.reject(err)
          }
          done({ file: id })
        })
      }].concat(this.options.importer || [])
    })

    return {
      code: res.css.toString(),
      map: res.map && res.map.toString()
    }
  }
}
