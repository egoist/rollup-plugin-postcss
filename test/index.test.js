import path from 'path'
import fs from 'fs-extra'
import { rollup } from 'rollup'
import postcss from '../src'

process.env.ROLLUP_POSTCSS_TEST = true
/**
 * solve jest timeout on Windows OS
 */
const JEST_TIMEOUT = process.platform === 'win32' ? 20000 : 5000

function fixture(...args) {
  return path.join(__dirname, 'fixtures', ...args)
}

beforeAll(() => fs.remove(fixture('dist')))

async function write({ input, outDir, options }) {
  const { delayResolve, ...postCssOptions } = options

  let first = true
  // Delay the resolving of the first css file
  const lateResolve = {
    name: 'late-resolve',
    async resolveId(importee) {
      // when it's not a css file and not the first css file we return
      if (!first || !importee.endsWith('.css')) {
        return null
      }

      first = false

      // delay resolving
      return new Promise(resolve => {
        setTimeout(() => resolve(null), 1000)
      })
    }
  }

  outDir = fixture('dist', outDir)
  const bundle = await rollup({
    input: fixture(input),
    plugins: [postcss(postCssOptions), delayResolve && lateResolve].filter(
      Boolean
    )
  })
  await bundle.write({
    format: 'cjs',
    file: path.join(outDir, 'bundle.js')
  })
  let cssCodePath = path.join(outDir, 'bundle.css')
  if (typeof options.extract === 'string') {
    cssCodePath = path.isAbsolute(options.extract) ?
      options.extract :
      path.join(outDir, options.extract)
  }

  const cssMapPath = `${cssCodePath}.map`
  const jsCodePath = path.join(outDir, 'bundle.js')
  return {
    jsCode() {
      return fs.readFile(jsCodePath, 'utf8')
    },
    cssCode() {
      return fs.readFile(cssCodePath, 'utf8')
    },
    cssMap() {
      return fs.readFile(cssMapPath, 'utf8')
    },
    hasCssFile() {
      return fs.pathExists(cssCodePath)
    },
    hasCssMapFile() {
      return fs.pathExists(cssMapPath)
    }
  }
}

function snapshot({ title, input, outDir, options = {} }) {
  test(
    title,
    async () => {
      let result
      try {
        result = await write({
          input,
          outDir,
          options
        })
      } catch (error) {
        const frame = error.codeFrame || error.snippet
        if (frame) {
          throw new Error(frame + error.message)
        }

        throw error
      }

      expect(await result.jsCode()).toMatchSnapshot('js code')

      if (options.extract) {
        expect(await result.hasCssFile()).toBe(true)
        expect(await result.cssCode()).toMatchSnapshot('css code')
      }

      const sourceMap = options && options.sourceMap
      if (sourceMap === 'inline') {
        expect(await result.hasCssMapFile()).toBe(false)
      } else if (sourceMap === true) {
        expect(await result.hasCssMapFile()).toBe(Boolean(options.extract))
        if (options.extract) {
          expect(await result.cssMap()).toMatchSnapshot('css map')
        }
      }
    },
    JEST_TIMEOUT
  )
}

function snapshotMany(title, tests) {
  describe(title, () => {
    for (const test of tests) {
      snapshot({
        ...test,
        outDir: `${title}--${test.title}`
      })
    }
  })
}

snapshotMany('basic', [
  {
    title: 'simple',
    input: 'simple/index.js'
  },
  {
    title: 'postcss-config',
    input: 'postcss-config/index.js'
  },
  {
    title: 'skip-loader',
    input: 'skip-loader/index.js',
    options: {
      use: ['loader'],
      loaders: [
        {
          name: 'loader',
          test: /\.random$/,
          process() {
            return 'lol'
          }
        }
      ]
    }
  },
  {
    title: 'postcss-options',
    input: 'postcss-options/index.js',
    options: {
      plugins: [require('autoprefixer')()]
    }
  },
  {
    title: 'on-import',
    input: 'simple/index.js',
    options: {
      onImport: () => {}
    }
  }
])

snapshotMany('minimize', [
  {
    title: 'inject',
    input: 'simple/index.js',
    options: {
      minimize: true
    }
  },
  {
    title: 'extract',
    input: 'simple/index.js',
    options: {
      minimize: true,
      extract: true
    }
  },
  {
    title: 'extract-sourcemap-true',
    input: 'simple/index.js',
    options: {
      minimize: true,
      extract: true,
      sourceMap: true
    }
  },
  {
    title: 'extract-sourcemap-inline',
    input: 'simple/index.js',
    options: {
      minimize: true,
      extract: true,
      sourceMap: 'inline'
    }
  }
])

snapshotMany('modules', [
  {
    title: 'inject',
    input: 'css-modules/index.js',
    options: {
      modules: true
    }
  },
  {
    title: 'inject-object',
    input: 'css-modules/index.js',
    options: {
      autoModules: false,
      modules: {
        getJSON() {
          //
        }
      }
    }
  },
  {
    title: 'named-exports',
    input: 'named-exports/index.js',
    options: {
      modules: true,
      namedExports: true
    }
  },
  {
    title: 'named-exports-custom-class-name',
    input: 'named-exports/index.js',
    options: {
      modules: true,
      namedExports(name) {
        return name + 'hacked'
      }
    }
  },
  {
    title: 'extract',
    input: 'css-modules/index.js',
    options: {
      modules: true,
      extract: true
    }
  },
  {
    title: 'auto-modules',
    input: 'auto-modules/index.js'
  }
])

snapshotMany('sourcemap', [
  {
    title: 'true',
    input: 'simple/index.js',
    options: {
      sourceMap: true
    }
  },
  // Is it broken?
  {
    title: 'inline',
    input: 'simple/index.js',
    options: {
      sourceMap: 'inline'
    }
  }
])

snapshotMany('extract', [
  {
    title: 'true',
    input: 'simple/index.js',
    options: {
      extract: true
    }
  },
  {
    title: 'custom-path',
    input: 'simple/index.js',
    options: {
      extract: fixture('dist/extract--custom-path/this/is/extracted.css'),
      sourceMap: true
    }
  },
  {
    title: 'relative-path',
    input: 'simple/index.js',
    options: {
      extract: 'this/is/extracted.css',
      sourceMap: true
    }
  },
  {
    title: 'sourcemap-true',
    input: 'simple/index.js',
    options: {
      sourceMap: true,
      extract: true
    }
  },
  {
    title: 'sourcemap-inline',
    input: 'simple/index.js',
    options: {
      sourceMap: 'inline',
      extract: true
    }
  },
  {
    title: 'nested',
    input: 'nested/index.js',
    options: {
      sourceMap: 'inline',
      extract: true
    }
  },
  {
    title: 'nested-delay-resolve',
    input: 'nested/index.js',
    options: {
      sourceMap: 'inline',
      extract: true,
      delayResolve: true
    }
  }
])

snapshotMany('inject', [
  {
    title: 'top',
    input: 'simple/index.js',
    options: {
      inject: {
        insertAt: 'top'
      }
    }
  },
  {
    title: 'function',
    input: 'simple/index.js',
    options: {
      inject: variableName => `console.log(${variableName})`
    }
  },
  {
    title: 'false',
    input: 'simple/index.js',
    options: {
      inject: false
    }
  }
])

snapshotMany('sass', [
  {
    title: 'default',
    input: 'sass/index.js'
  },
  {
    title: 'sourcemap',
    input: 'sass/index.js',
    options: {
      sourceMap: true
    }
  },
  {
    title: 'modules',
    input: 'sass-modules/index.js',
    options: {
      modules: true
    }
  },
  {
    title: 'data-prepend',
    input: 'sass-data-prepend/index.js',
    options: {
      use: [['sass', { data: '@import \'prepend\';' }]]
    }
  },
  {
    title: 'data-prepend',
    input: 'sass-data-prepend/index.js',
    options: {
      use: {
        sass: { data: '@import \'prepend\';' }
      }
    }
  },
  {
    title: 'import',
    input: 'sass-import/index.js'
  }
])

test('onExtract', async () => {
  const result = await write({
    input: 'simple/index.js',
    outDir: 'onExtract',
    options: {
      extract: true,
      onExtract() {
        return false
      }
    }
  })
  expect(await result.jsCode()).toMatchSnapshot()
  expect(await result.hasCssFile()).toBe(false)
})

test('augmentChunkHash', async () => {
  const outDir = fixture('dist', 'augmentChunkHash')
  const cssFiles = ['simple/foo.css', 'simple/foo.css', 'simple/bar.css']

  const outputFiles = []
  /* eslint-disable no-await-in-loop */
  for (const file of cssFiles) {
    const newBundle = await rollup({
      input: fixture(file),
      plugins: [postcss({ extract: true })]
    })
    const entryFileName = file.split('.')[0]
    const { output } = await newBundle.write({
      dir: outDir,
      entryFileNames: `${entryFileName}.[hash].css`
    })
    outputFiles.push(output[0])
  }

  const [fooOne, fooTwo, barOne] = outputFiles

  const fooHash = fooOne.fileName.split('.')[1]
  expect(fooHash).toBeTruthy() // Verify that [hash] part of `foo.[hash].css` is truthy
  expect(fooOne.fileName).toEqual(fooTwo.fileName) // Verify that the foo hashes to the same fileName

  const barHash = barOne.fileName.split('.')[1]
  expect(barHash).not.toEqual(fooHash) // Verify that foo and bar does not hash to the same
})
