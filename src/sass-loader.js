import path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import importCwd from 'import-cwd'

const moduleRe = /^~([a-z0-9]|@).+/i

const getUrlOfPartial = url => {
  const parsedUrl = path.parse(url)
  return `${parsedUrl.dir}${path.sep}_${parsedUrl.base}`
}

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

        const moduleUrl = url.slice(1)
        const partialUrl = getUrlOfPartial(moduleUrl)

        const options = {
          basedir: path.dirname(importer),
          extensions: ['.scss', '.sass', '.css']
        }
        const finishImport = id => {
          done({
            // Do not add `.css` extension in order to inline the file
            file: id.endsWith('.css') ? id.replace(/\.css$/, '') : id
          })

          return id
        }

        // Give precedence to importing a partial
        pify(resolve)(partialUrl, options)
          .then(finishImport)
          .catch(() => {
            return pify(resolve)(moduleUrl, options).then(finishImport)
          })
      }].concat(this.options.importer || [])
    })

    return {
      code: res.css.toString(),
      map: res.map && res.map.toString()
    }
  }
}
