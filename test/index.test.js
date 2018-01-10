import path from 'path'
import fs from 'fs-extra'
import { rollup } from 'rollup'
import postcss from '../src'

function fixture(...args) {
  return path.join(__dirname, 'fixtures', ...args)
}

async function generate({
  input,
  ...options
}) {
  const bundle = await rollup({
    input: fixture(input),
    plugins: [
      postcss(options)
    ]
  })
  const res = await bundle.generate({
    format: 'cjs',
    sourcemap: true
  })
  return res
}

async function write({
  input,
  ...options
}) {
  const dirname = path.dirname(input)
  const bundle = await rollup({
    input: fixture(input),
    plugins: [
      postcss(options)
    ]
  })
  await bundle.write({
    format: 'cjs',
    sourcemap: true,
    file: fixture(dirname, 'dist/bundle.js')
  })
  const codePath = fixture(dirname, 'dist/bundle.css')
  const mapPath = fixture(dirname, 'dist/bundle.css.map')
  return {
    code() {
      return fs.readFile(codePath, 'utf8')
    },
    map() {
      return fs.readFile(mapPath, 'utf8')
    },
    hasCode() {
      return fs.pathExists(codePath)
    },
    hasMap() {
      return fs.pathExists(mapPath)
    }
  }
}

test('simple', async () => {
  const res = await generate({
    input: 'simple/index.js'
  })
  expect(res.code).toMatchSnapshot()
})

test('extract', async () => {
  const res = await write({
    input: 'simple/index.js',
    use: [
      ['css', { extract: true }],
      'postcss'
    ]
  })

  expect(await res.hasCode()).toBe(true)
  expect(await res.hasMap()).toBe(true)
  expect(await res.code()).toMatchSnapshot('code')
  expect(await res.map()).toMatchSnapshot('map')
})
