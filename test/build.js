import path from 'path'
import { rollup } from 'rollup'
import babel from 'rollup-plugin-babel'
import sugarss from 'sugarss'
import stylus from 'stylus'
import postcss from '../src'

export function buildDefault() {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        plugins: [require('postcss-nested')]
      }),
      babel({
        babelrc: false,
        presets: [['es2015', { modules: false }]],
        include: '**/*.js',
        sourceMap: true
      })
    ],
    input: path.resolve('./fixtures/fixture.js')
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      sourcemap: true
    })
    bundle.write({
      file: './output/output.js',
      format: 'umd',
      sourcemap: true
    })
    return result
  })
}

export function buildWithParser() {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.sss',
        sourceMap: true,
        parser: sugarss,
        plugins: [require('postcss-nested')]
      }),
      babel({
        babelrc: false,
        presets: [['es2015', { modules: false }]],
        include: '**/*.js',
        sourceMap: true
      })
    ],
    input: path.resolve('./fixtures/fixture_parser.js')
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      sourcemap: true
    })
    bundle.write({
      file: './output/output_parser.js',
      format: 'umd',
      sourcemap: true
    })
    return result
  })
}

export function buildWithCssModules(file = 'modules', getExportNamed = false) {
  const exportMap = {}
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        plugins: [
          require('postcss-modules')({
            getJSON(id, exportTokens) {
              exportMap[id] = exportTokens
            }
          })
        ],
        getExportNamed,
        getExport(id) {
          return exportMap[id]
        }
      }),
      babel({
        babelrc: false,
        presets: [['es2015', { modules: false }]],
        include: '**/*.js',
        sourceMap: true
      })
    ],
    input: path.resolve(`./fixtures/fixture_${file}.js`)
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      name: 'default',
      sourcemap: true
    })
    bundle.write({
      file: `./output/output_${file}.js`,
      name: 'default',
      format: 'umd',
      sourcemap: true
    })
    return result
  })
}

export function buildCombinedStyles(getExportNamed = false) {
  const exportMap = {}
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        plugins: [
          require('postcss-nested'),
          require('postcss-modules')({
            getJSON(id, exportTokens) {
              exportMap[id] = exportTokens
            }
          })
        ],
        combineStyleTags: true,
        getExportNamed,
        getExport(id) {
          return exportMap[id]
        }
      }),
      babel({
        babelrc: false,
        presets: [['es2015', { modules: false }]],
        include: '**/*.js',
        sourceMap: true
      })
    ],
    input: path.resolve('./fixtures/fixture_combine_styles.js')
  }).then(bundle => {
    const result = bundle.generate({
      format: 'iife',
      sourcemap: true,
      name: 's'
    })
    bundle.write({
      file: './output/output_combine_styles.js',
      format: 'iife',
      name: 's',
      sourcemap: true
    })
    return result
  })
}

export function buildWithExtract(extract = true) {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        extract
      }),
      babel({
        babelrc: false,
        presets: [['es2015', { modules: false }]],
        include: '**/*.js',
        sourceMap: true
      })
    ],
    input: path.resolve('./fixtures/fixture_extract.js')
  }).then(bundle => {
    return bundle.write({
      file: './output/output_extract.js',
      name: 'default',
      format: 'umd',
      sourcemap: true
    })
  })
}

export function buildWithStylus() {
  const preprocessor = (content, id) =>
    new Promise((resolve, reject) => {
      const renderer = stylus(content, {
        filename: id,
        sourcemap: { inline: true }
      })
      renderer.render((err, code) => {
        if (err) {
          return reject(err)
        }
        resolve({ code, map: renderer.sourcemap })
      })
    })

  return rollup({
    input: path.resolve('./fixtures/fixture_preprocessor.js'),
    plugins: [
      postcss({
        extensions: ['.styl'],
        preprocessor
      })
    ]
  }).then(bundle => {
    const result = bundle.generate({
      format: 'cjs'
    })
    return result
  })
}
