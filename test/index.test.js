import path from 'path'
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
  const bundle = await rollup({
    input: fixture(input),
    plugins: [
      postcss(options)
    ]
  })
  return bundle.write({
    format: 'cjs',
    sourcemap: true,
    file: fixture('dist/bundle.js')
  })
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
  console.log(res)
})
