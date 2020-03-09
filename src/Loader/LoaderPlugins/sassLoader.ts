import type { Importer, ImporterReturnType, Options, Result } from 'node-sass'
import PQueue from 'p-queue'
import * as path from 'path'
import pify from 'pify'
import resolve from 'resolve'
import { SourceDescription } from 'rollup'

import { Loader } from '../../type'
import { loadModule } from '../../util'

// This queue makes sure node-sass leaves one thread available for executing fs tasks
// See: https://github.com/sass/node-sass/issues/857
const threadPoolSize: number = Number(process.env.UV_THREADPOOL_SIZE) || 4
const workQueue = new PQueue({ concurrency: threadPoolSize - 1 })

const moduleRe = /^~([a-z0-9]|@).+/i

const getUrlOfPartial = (url: string) => {
  const parsedUrl = path.parse(url)
  return `${parsedUrl.dir}${path.sep}_${parsedUrl.base}`
}

const resolvePromise = pify(resolve)

// List of supported SASS modules in the order of preference
const sassModuleIds = ['node-sass', 'sass']

function loadSassOrThrow () {
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

const sassLoader: Loader = {
  name: 'sass',
  always: false,
  async process ({ code }, context): Promise<SourceDescription> {
    return new Promise((resolve, reject) => {
      const sass = loadSassOrThrow()
      const render = pify(sass.render.bind(sass))
      const data = context.options.data || ''
      return workQueue.add(() =>
        render({
          ...context.options,
          file: context.id,
          data: data + code,
          indentedSyntax: /\.sass$/.test(context.id),
          sourceMap: context.sourceMap,
          importer: [
            (url: string, importer: string, done: (data: ImporterReturnType) => void) => {
              if (!moduleRe.test(url)) return done({ file: url })

              const moduleUrl = url.slice(1)
              const partialUrl = getUrlOfPartial(moduleUrl)

              const options = {
                basedir: path.dirname(importer),
                extensions: ['.scss', '.sass', '.css']
              }
              const finishImport = (id: string) => {
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
                  if (
                    err.code === 'MODULE_NOT_FOUND' ||
                    err.code === 'ENOENT'
                  ) {
                    resolvePromise(moduleUrl, options)
                      .then(finishImport)
                      .catch(next)
                  } else {
                    next()
                  }
                })
            }
          ].concat(context.options.importer || []) as Importer[]
        } as Options)
          .then((res: Result) => {
            for (const file of res.stats.includedFiles) {
              context.dependencies.add(file)
            }
            resolve({
              code: res.css.toString(),
              map: res.map && res.map.toString()
            })
          }).catch(reject)
      )
    })
  },
  test (id) {
    return /\.(sass|scss)$/.test(id)
  }
}

export default sassLoader
