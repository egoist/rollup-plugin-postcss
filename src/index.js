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

import Watcher from './watcher'

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
          if (getExportNamed) {
            Object.entries(codeExportDefault).forEach(([key, v]) => {
              let newKey = escapeClassNameDashes(key)

              if (reserved.check(key)) newKey = `$${key}$`
              codeExportSparse += `export const ${newKey}=${JSON.stringify(
                v
              )};\n`

              if (newKey !== key) {
                console.warn(
                  chalk.yellow('use'),
                  chalk.cyan(`${newKey}`),
                  chalk.yellow('to import'),
                  chalk.cyan(`${key}`),
                  chalk.yellow('className')
                )
                codeExportDefault[newKey] = v
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

function _intro(needsTransformation, combineStyleTags, injectStyleFuncCode, injectFnName){
  let ret

  if (needsTransformation) {
    if (combineStyleTags) {
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
  const getExportNamed = options.getExportNamed || false
  const combineStyleTags = Boolean(options.combineStyleTags)
  const extract = Boolean(options.extract)
  const extractPath = isString(options.extract) ? options.extract : null

  let concat = null
  let watcher
  const transformedFiles = {}

  const injectStyleFuncCode = styleInject.toString().replace(/styleInject/, injectFnName)
  const needsTransformation = extract || combineStyleTags

  if (isFunction(options.getInstance) && extract) {
    watcher = new Watcher()
    watcher.on('file-change', (file) => {
      console.log(`${file} changed, rebuilding`)
      // TODO: rebuild
    })
    options.getInstance({
      watcher: watcher
    })
  }

  return {
    intro() {
      if (needsTransformation) {
        Object.entries(transformedFiles).forEach(([file, {css, map}]) => concat.add(file, css, map))
      }

      return _intro(needsTransformation, combineStyleTags, injectStyleFuncCode, injectFnName)
    },
    transform(code, id) {
      if (!filter(id) || !extensions.includes(path.extname(id))) {
        return null
      }

      watcher.source = id

      return _transform(code, id, options, needsTransformation, transformedFiles)
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
