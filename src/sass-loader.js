import path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import PQueue from 'p-queue'
import { loadModule } from './utils/load-module'

// This queue makes sure node-sass leaves one thread available for executing fs tasks
// See: https://github.com/sass/node-sass/issues/857
const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4
const workQueue = new PQueue({ concurrency: threadPoolSize - 1 })

const moduleRe = /^~([a-z\d]|@).+/i

const getUrlOfPartial = url => {
  const parsedUrl = path.parse(url)
  return `${parsedUrl.dir}${path.sep}_${parsedUrl.base}`
}

const resolvePromise = pify(resolve)

// List of supported SASS modules in the order of preference
const sassModuleIds = ['node-sass', 'sass']

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */
export default {
  name: 'sass',
  test: /\.(sass|scss)$/,
  process({ code }) {
    return new Promise((resolve, reject) => {
      const sass = loadSassOrThrow()
      const render = pify(sass.render.bind(sass))
      const data = this.options.data || ''
      workQueue.add(() =>
        render({
          ...this.options,
          file: this.id,
          data: data + code,
          indentedSyntax: /\.sass$/.test(this.id),
          sourceMap: this.sourceMap,
          // `outfile` doesn't actually create an outfile – just to create map object
          outFile: this.sourceMap && path.basename(this.id),
          sourceMapContents: true,
          sourceMapEmbed: false,
          omitSourceMapUrl: true,
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
                .catch(error => {
                  if (
                    error.code === 'MODULE_NOT_FOUND' ||
                    error.code === 'ENOENT'
                  ) {
                    resolvePromise(moduleUrl, options)
                      .then(finishImport)
                      .catch(next)
                  } else {
                    next()
                  }
                })
            }
          ].concat(this.options.importer || [])
        })
          .then(result => {
            for (const file of result.stats.includedFiles) {
              this.dependencies.add(file)
            }

            resolve({
              code: result.css.toString(),
              map: result.map && result.map.toString()
            })
          })
          .catch(reject)
      )
    })
  }
}

function loadSassOrThrow() {
  // Loading one of the supported modules
  for (const moduleId of sassModuleIds) {
    const module = loadModule(moduleId)
    if (module) {
      return module
    }
  }

  // Throwing exception if module can't be loaded
  throw new Error(
    'You need to install one of the following packages: ' +
    sassModuleIds.map(moduleId => `"${moduleId}"`).join(', ') + ' ' +
    'in order to process SASS files'
  )
}
