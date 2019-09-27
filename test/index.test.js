import path from 'path'
import fs from 'fs-extra'
import { rollup } from 'rollup'
import nodeSass from 'node-sass'
import less from 'less'
import stylus from 'stylus'
import postcss from '../src'

process.env.ROLLUP_POSTCSS_TEST = true

function fixture(...args) {
  return path.join(__dirname, 'fixtures', ...args)
}

beforeAll(() => fs.remove(fixture('dist')))

async function write({
  input,
  outDir,
  options
}) {
  outDir = fixture('dist', outDir)
  const bundle = await rollup({
    input: fixture(input),
    plugins: [
      postcss(options)
    ]
  })
  await bundle.write({
    format: 'cjs',
    file: path.join(outDir, 'bundle.js')
  })
  const cssCodePath = typeof options.extract === 'string' ? options.extract : path.join(outDir, 'bundle.css')
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

function snapshot({
  title,
  input,
  outDir,
  options = {}
}) {
  test(title, async () => {
    let res
    try {
      res = await write({
        input,
        outDir,
        options
      })
    } catch (err) {
      const frame = err.codeFrame || err.snippet
      if (frame) {
        throw new Error(frame + err.message)
      }
      throw err
    }

    expect(await res.jsCode()).toMatchSnapshot('js code')

    if (options.extract) {
      expect(await res.hasCssFile()).toBe(true)
      expect(await res.cssCode()).toMatchSnapshot('css code')
    }

    const sourceMap = options && options.sourceMap
    if (sourceMap === 'inline') {
      expect(await res.hasCssMapFile()).toBe(false)
    } else if (sourceMap === true) {
      expect(await res.hasCssMapFile()).toBe(Boolean(options.extract))
      if (options.extract) {
        expect(await res.cssMap()).toMatchSnapshot('css map')
      }
    }
  })
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
      plugins: [
        require('autoprefixer')()
      ]
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
    title: 'provided instance',
    input: 'sass/index.js',
    options: {
      use: [['sass', { sassInstance: nodeSass }]]
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
    title: 'import',
    input: 'sass-import/index.js'
  }
])

snapshotMany('less', [
  {
    title: 'default',
    input: 'less/index.js'
  },
  {
    title: 'sourcemap',
    input: 'less/index.js',
    options: {
      sourceMap: true
    }
  },
  {
    title: 'provided instance',
    input: 'less/index.js',
    options: {
      use: [['less', { lessInstance: less }]]
    }
  }
])

snapshotMany('stylus', [
  {
    title: 'default',
    input: 'stylus/index.js'
  },
  {
    title: 'sourcemap',
    input: 'stylus/index.js',
    options: {
      sourceMap: true
    }
  },
  {
    title: 'provided instance',
    input: 'stylus/index.js',
    options: {
      use: [['stylus', { stylusInstance: stylus }]]
    }
  }
])

test('onExtract', async () => {
  const res = await write({
    input: 'simple/index.js',
    outDir: 'onExtract',
    options: {
      extract: true,
      onExtract() {
        return false
      }
    }
  })
  expect(await res.jsCode()).toMatchSnapshot()
  expect(await res.hasCssFile()).toBe(false)
})
