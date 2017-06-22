import path from 'path'
import fs from 'fs-extra'
import { createFilter } from 'rollup-pluginutils'
import postcss from 'postcss'
import styleInject from 'style-inject'
import Concat from 'concat-with-sourcemaps'
import reserved from 'reserved-words'
import chalk from 'chalk'

function escapeClassNameDashes(str) {
  return str.replace(/-+/g, match => {
    return `$${match.replace(/-/g, '_')}$`
  })
}
import {
  isFunction,
  isString,
  dummyPreprocessor,
  dashesCamelCase
} from './helpers'

function cwd(file) {
  return path.join(process.cwd(), file)
}

function extractCssAndWriteToFile(source, sourceMap, dest, manualDest) {
  return Promise.resolve()
    .then(() => {
      if (manualDest) {
        return fs.ensureDir(path.dirname(dest))
      }
    })
    .then(() => {
      const fileName = path.basename(dest, path.extname(dest)) + '.css'
      const cssOutputDest = path.join(path.dirname(dest), fileName)
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
          css += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
            map,
            'utf8'
          ).toString('base64')}*/`
        } else {
          css += `\n/*# sourceMappingURL=${fileName}.map */`
          promises.push(fs.writeFile(`${cssOutputDest}.map`, map))
        }
      }
      promises.push(fs.writeFile(cssOutputDest, css))
      return Promise.all(promises)
    })
}

function _transform(code, id, options, needsTransformation, transformedFiles){
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
        input.code.replace(
          /\/\*[@#][\s\t]+sourceMappingURL=.*?\*\/$/gm,
          ''
        ),
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
          if (getExportNamed) {
            Object.keys(codeExportDefault).forEach(key => {
              let newKey = escapeClassNameDashes(key)

              if (reserved.check(key)) newKey = `$${key}$`
              codeExportSparse += `export const ${newKey}=${JSON.stringify(
                codeExportDefault[key]
              )};\n`

              if (newKey !== key) {
                console.warn(
                  chalk.yellow('use'),
                  chalk.cyan(`${newKey}`),
                  chalk.yellow('to import'),
                  chalk.cyan(`${key}`),
                  chalk.yellow('className')
                )
                codeExportDefault[newKey] = codeExportDefault[key]
              }
            })
          }
        }

        if (needsTransformation) {
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

export default function(options = {}) {
  const filter = createFilter(options.include, options.exclude)
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExportNamed = options.getExportNamed || false
  const combineStyleTags = Boolean(options.combineStyleTags)
  const extract = Boolean(options.extract)
  const extractPath = isString(options.extract) ? options.extract : null

  let concat = null
  const transformedFiles = {}

  const injectStyleFuncCode = styleInject
    .toString()
    .replace(/styleInject/, injectFnName)

  return {
    intro() {
      if (extract || combineStyleTags) {
        concat = new Concat(
          true,
          path.basename(extractPath || 'styles.css'),
          '\n'
        )
        Object.keys(transformedFiles).forEach(file => {
          concat.add(
            file,
            transformedFiles[file].css,
            transformedFiles[file].map
          )
        })
        if (combineStyleTags) {
          return `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(
            concat.content.toString('utf8')
          )})`
        }
      } else {
        return injectStyleFuncCode
      }
    },
    transform(code, id) {
      if (!filter(id) || extensions.indexOf(path.extname(id)) === -1) {
        return null
      }

      return _transform(code, id, options, extract || combineStyleTags, transformedFiles)
    },
    onwrite(opts) {
      if (extract) {
        return extractCssAndWriteToFile(
          concat,
          options.sourceMap,
          extractPath ? extractPath : opts.dest,
          extractPath
        )
      }
    }
  }
}
