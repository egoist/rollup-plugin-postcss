import path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import importCwd from 'import-cwd'

const moduleRe = /^~([a-z0-9]|@).+/i

export default {
  name: 'sass',
  test: /\.s[ac]ss$/,
  async process({ code }) {
    const sass = importCwd('node-sass')
    const res = await pify(sass.render.bind(sass))({
      ...this.options,
      file: this.id,
      data: code,
      indentedSyntax: /\.sass$/.test(this.id),
      sourceMap: this.sourceMap,
      importer: [(url, importer, done) => {
        if (!moduleRe.test(url)) return done({ file: url })

        resolve(url.slice(1), {
          basedir: path.dirname(importer),
          extensions: ['.scss', '.sass', '.css']
        }, (err, id) => {
          if (err) {
            return Promise.reject(err)
          }
          done({
            // Do not add `.css` extension in order to inline the file
            file: id.endsWith('.css') ? id.replace(/\.css$/, '') : id
          })
        })
      }].concat(this.options.importer || [])
    })

    return {
      code: res.css.toString(),
      map: res.map && res.map.toString()
    }
  }
}
