import path from 'path'
import fs from 'fs-extra'
import { rollup } from 'rollup'
import postcss from '../src'

function fixture(...args) {
  return path.join(__dirname, 'fixtures', ...args)
}

beforeAll(() => fs.remove(fixture('dist')))

async function write({
  input,
  dirname,
  options
}) {
  dirname = fixture('dist', dirname)
  const bundle = await rollup({
    input: fixture(input),
    plugins: [
      postcss(options)
    ]
  })
  await bundle.write({
    format: 'cjs',
    file: path.join(dirname, 'bundle.js')
  })
  const cssCodePath = typeof options.extract === 'string' ? options.extract : path.join(dirname, 'bundle.css')
  const cssMapPath = `${cssCodePath}.map`
  const jsCodePath = path.join(dirname, 'bundle.js')
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
  options = {}
}) {
  test(title, async () => {
    const res = await write({
      input,
      dirname: title,
      options
    })

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

snapshot({
  title: 'simple',
  input: 'simple/index.js'
})

snapshot({
  title: 'extract',
  input: 'simple/index.js',
  options: {
    extract: true
  }
})

snapshot({
  title: 'extract:path',
  input: 'simple/index.js',
  options: {
    extract: fixture('dist/extract:path/this/is/extracted.css'),
    sourceMap: true
  }
})

snapshot({
  title: 'minimize:inject',
  input: 'simple/index.js',
  options: {
    minimize: true
  }
})

snapshot({
  title: 'minimize:extract',
  input: 'simple/index.js',
  options: {
    minimize: true,
    extract: true
  }
})

snapshot({
  title: 'modules:inject',
  input: 'css-modules/index.js',
  options: {
    modules: true
  }
})

snapshot({
  title: 'modules:named-exports',
  input: 'named-exports/index.js',
  options: {
    modules: true,
    namedExports: true
  }
})

snapshot({
  title: 'modules:named-exports-custom-class-name',
  input: 'named-exports/index.js',
  options: {
    modules: true,
    namedExports(name) {
      return name + 'hacked'
    }
  }
})

snapshot({
  title: 'modules:extract',
  input: 'css-modules/index.js',
  options: {
    modules: true,
    extract: true
  }
})

snapshot({
  title: 'sourcemap:true',
  input: 'simple/index.js',
  options: {
    sourceMap: true
  }
})

snapshot({
  title: 'extract::sourcemap:true',
  input: 'simple/index.js',
  options: {
    sourceMap: true,
    extract: true
  }
})

// inline is actually broken for now
snapshot({
  title: 'sourcemap:inline',
  input: 'simple/index.js',
  options: {
    sourceMap: 'inline'
  }
})

snapshot({
  title: 'extract::sourcemap:inline',
  input: 'simple/index.js',
  options: {
    sourceMap: 'inline',
    extract: true
  }
})

snapshot({
  title: 'inject:top',
  input: 'simple/index.js',
  options: {
    inject: {
      insertAt: 'top'
    }
  }
})

snapshot({
  title: 'sass',
  input: 'sass/index.js'
})

snapshot({
  title: 'sass:sourcemap',
  input: 'sass/index.js',
  options: {
    sourceMap: true
  }
})

snapshot({
  title: 'postcss-config',
  input: 'postcss-config/index.js'
})

snapshot({
  title: 'sass:modules',
  input: 'sass-modules/index.js',
  options: {
    modules: true
  }
})

snapshot({
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
})

snapshot({
  title: 'postcss-options',
  input: 'postcss-options/index.js',
  options: {
    plugins: [
      require('autoprefixer')()
    ]
  }
})

snapshot({
  title: 'inject:false',
  input: 'simple/index.js',
  options: {
    inject: false
  }
})

snapshot({
  title: 'sass:import',
  input: 'sass-import/index.js'
})

test('onExtract', async () => {
  const res = await write({
    input: 'simple/index.js',
    dirname: 'onExtract',
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
