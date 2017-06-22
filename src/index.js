import path from 'path'
import fs from 'fs-extra'
import { createFilter } from 'rollup-pluginutils'
import postcss from 'postcss'
import styleInject from 'style-inject'
import Concat from 'concat-with-sourcemaps'
import reserved from 'reserved-words'
import chalk from 'chalk'

import {
  isFunction,
  isString,
  dummyPreprocessor,
  dashesCamelCase
} from './helpers'

import Watcher from './watcher'

function cwd(file) {
  return path.join(process.cwd(), file)
}

function needsTransformation(options) {
  return Boolean(options.combineStyleTags) || Boolean(options.extract)
}

function extractCssAndWriteToFile(source, manualDest, autoDest, sourceMap) {
  return Promise.resolve()
    .then(() => {
      if (manualDest) {
        return fs.ensureDir(path.dirname(manualDest))
      }
    })
    .then(() => {
      const fileName = path.basename(autoDest, path.extname(autoDest)) + '.css'
      const cssOutputDest =
        manualDest || path.join(path.dirname(autoDest), fileName)
      let css = source.content.toString('utf8')
      const promises = []
      if (sourceMap) {
        let map = source.sourceMap
        if (!manualDest) {
          map = JSON.parse(map)
          map.file = fileName
          map = JSON.stringify(map)
        }
        if (sourceMap === 'inline') {
          css += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(map, 'utf8').toString('base64')}*/`
        } else {
          css += `\n/*# sourceMappingURL=${fileName}.map */`
          promises.push(fs.writeFile(`${cssOutputDest}.map`, map))
        }
      }
      promises.push(fs.writeFile(cssOutputDest, css))
      return Promise.all(promises)
    })
}

function _transform({ code, id }, options, transformedFiles, injectFnName) {
  const opts = {
    from: options.from ? cwd(options.from) : id,
    to: options.to ? cwd(options.to) : id,
    map: {
      inline: false,
      annotation: false
    },
    parser: options.parser
  }

  return (options.preprocessor || dummyPreprocessor)(code, id).then(input => {
    if (input.map && input.map.mappings) {
      opts.map.prev = input.map
    }
    return postcss(options.plugins || [])
      .process(
        input.code.replace(/\/\*[@#][\s\t]+sourceMappingURL=.*?\*\/$/gm, ''),
        opts
      )
      .then(result => {
        let codeExportDefault
        let codeExportSparse = ''
        const ret = {
          map: { mappings: '' }
        }

        if (isFunction(options.getExport)) {
          codeExportDefault = options.getExport(result.opts.from)

          Object.entries(codeExportDefault).forEach(([k, v]) => {
            const camelCasedKey = dashesCamelCase(k)
            if (reserved.check(camelCasedKey)) {
              console.warn(
                chalk.yellow(`You are using a reserved keyword`),
                chalk.cyan(camelCasedKey),
                chalk.yellow(
                  `as className so it's not available in named exports`
                )
              )
              console.warn(chalk.dim(`location: ${id}`))
            } else {
              codeExportSparse += `export const ${camelCasedKey}=${JSON.stringify(v)};\n`
            }
            if (camelCasedKey !== k) {
              codeExportDefault[camelCasedKey] = v
            }
          })
        }

        if (needsTransformation(options)) {
          transformedFiles[result.opts.from] = {
            css: result.css,
            map: result.map && result.map.toString()
          }

          ret.code = `${codeExportSparse}export default ${JSON.stringify(codeExportDefault)};`
        } else {
          ret.code = `${codeExportSparse}export default ${injectFnName}(${JSON.stringify(result.css)},${JSON.stringify(codeExportDefault)});`
          if (options.sourceMap && result.map) {
            ret.map = JSON.parse(result.map)
          }
        }
        return ret
      })
  })
}

function _intro(options, injectStyleFuncCode, injectFnName, concat) {
  let ret

  if (needsTransformation(options)) {
    if (options.combineStyleTags) {
      ret = `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(concat.content.toString('utf8'))})`
    }
  } else {
    ret = injectStyleFuncCode
  }

  return ret
}

export default function(options = {}) {
  const filter = createFilter(options.include, options.exclude)
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const extract = Boolean(options.extract)
  const extractPath = isString(options.extract) ? options.extract : null
  const injectStyleFuncCode = styleInject
    .toString()
    .replace(/styleInject/, injectFnName)

  let concat = null
  let watcher
  let source
  let destination
  const transformedFiles = {}
  let hadOnwrite = false

  function createConcat() {
    const concat = new Concat(
      true,
      path.basename(extractPath || 'styles.css'),
      '\n'
    )
    Object.entries(transformedFiles).forEach(([file, { css, map }]) =>
      concat.add(file, css, map)
    )
    return concat
  }

  if (isFunction(options.getInstance) && extract) {
    watcher = new Watcher()
    watcher.on('change', file => {
      console.log(`${file} changed, rebuilding...`)
      fs.readFile(source, 'utf8', (err, code) => {
        if (!err) {
          _transform(
            { code, id: source },
            options,
            transformedFiles,
            injectFnName
          )
            .then(() => {
              if (needsTransformation(options)) {
                concat = createConcat()
              }
              return _intro(options, injectStyleFuncCode, injectFnName, concat)
            })
            .then(() =>
              extractCssAndWriteToFile(
                concat,
                extractPath,
                destination,
                options.sourceMap
              )
            )
            .then(() => {
              console.log(`...done`)
            })
        }
      })
    })
    options.getInstance({
      watcher
    })
  }

  return {
    intro() {
      if (needsTransformation(options)) {
        concat = createConcat()
      }
      return _intro(options, injectStyleFuncCode, injectFnName, concat)
    },
    transform(code, id) {
      if (!filter(id) || !extensions.includes(path.extname(id))) {
        return null
      }

      source = id

      return _transform({ code, id }, options, transformedFiles, injectFnName)
    },
    onwrite(opts) {
      if (!hadOnwrite && extract) {
        hadOnwrite = true
        destination = opts.dest

        return extractCssAndWriteToFile(
          concat,
          extractPath,
          destination,
          options.sourceMap
        )
      }
    }
  }
}
