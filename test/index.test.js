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
  ...options
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
    sourcemap: true,
    file: path.join(dirname, 'bundle.js')
  })
  const cssCodePath = path.join(dirname, 'bundle.css')
  const cssMapPath = path.join(dirname, 'bundle.css.map')
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
    hasCssMap() {
      return fs.pathExists(cssMapPath)
    }
  }
}

function snapshot({
  title,
  input,
  ...options
}) {
  test(title, async () => {
    const res = await write({
      input: input,
      dirname: title,
      ...options
    })

    expect(await res.jsCode()).toMatchSnapshot('js code')

    if (options.extract) {
      expect(await res.hasCssFile()).toBe(true)
      expect(await res.cssCode()).toMatchSnapshot('css code')
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
  extract: true
})

snapshot({
  title: 'minimize:inject',
  input: 'simple/index.js',
  minimize: true
})

snapshot({
  title: 'minimize:extract',
  input: 'simple/index.js',
  minimize: true,
  extract: true
})

snapshot({
  title: 'modules:inject',
  input: 'css-modules/index.js',
  modules: true
})

snapshot({
  title: 'modules:extract',
  input: 'css-modules/index.js',
  modules: true,
  extract: true
})
