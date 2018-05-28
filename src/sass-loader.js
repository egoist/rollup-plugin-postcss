import path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import importCwd from 'import-cwd'
import PQueue from 'p-queue'

// This queue makes sure node-sass leaves one thread available for executing fs tasks
// See: https://github.com/sass/node-sass/issues/857
const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4
const workQueue = new PQueue({ concurrency: threadPoolSize - 1 })

const moduleRe = /^~([a-z0-9]|@).+/i

const getUrlOfPartial = url => {
  const parsedUrl = path.parse(url)
  return `${parsedUrl.dir}${path.sep}_${parsedUrl.base}`
}

const resolvePromise = pify(resolve)

export default {
  name: 'sass',
  test: /\.s[ac]ss$/,
  async process({ code }) {
    const sass = importCwd('node-sass')

    return new Promise((resolve, reject) => {
      workQueue.add(() =>
        pify(sass.render.bind(sass))({
          ...this.options,
          file: this.id,
          data: code,
          indentedSyntax: /\.sass$/.test(this.id),
          sourceMap: this.sourceMap,
          importer: [
            (url, importer, done) => {
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
              }

              const next = () => {
                // Catch all resolving errors, return the original file and pass responsibility back to other custom importers
                done({ file: url })
              }

              // Give precedence to importing a partial
              resolvePromise(partialUrl, options)
                .then(finishImport)
                .catch(err => {
                  if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ENOENT') {
                    resolvePromise(moduleUrl, options)
                      .then(finishImport)
                      .catch(next)
                  } else {
                    next()
                  }
                })
            }
          ].concat(this.options.importer || [])
        }).then(res =>
          resolve({
            code: res.css.toString(),
            map: res.map && res.map.toString()
          })
        ).catch(reject)
      )
    })
  }
}
