import fs from 'fs'
import test from 'ava'
import requireFromString from 'require-from-string'
import rm from 'rimraf'
import {
  buildDefault,
  buildWithParser,
  buildWithCssModules,
  buildCombinedStyles,
  buildWithExtract,
  buildWithStylus
} from './build'

test.before(() => {
  process.chdir(__dirname)
})

test.after(() => {
  rm.sync('./output')
})

test('test postcss', async t => {
  const { code } = await buildDefault().catch(err => console.log(err.stack))
  t.true(code.indexOf('h1') > -1)
  t.true(code.indexOf('html body') > -1)
})

test('use sugarss as parser', async t => {
  const { code } = await buildWithParser().catch(err => console.log(err.stack))
  t.true(code.indexOf('font-size: 20px') > -1)
})

test('use cssmodules', async t => {
  const { code } = await buildWithCssModules('modules').catch(err =>
    console.log(err.stack)
  )
  const exported = requireFromString(code)
  t.regex(exported.style.trendy, /trendy_/)
  t.regex(exported.style['foo--bar'], /foo--bar_/)
})

test('use cssmodules with named exports', async t => {
  const { code } = await buildWithCssModules(
    'modules_export_named',
    true
  ).catch(err => console.log(err.stack))
  const exported = requireFromString(code)
  t.regex(exported.style.trendy, /trendy_/)
  t.regex(exported.style.foo$_$bar, /foo-bar_/)
  t.regex(exported.namedExports.foo$_$bar, /foo-bar_/)
  t.regex(exported.style.foo$__$bar, /foo--bar_/)
  t.regex(exported.style['foo--bar'], /foo--bar_/)
  t.regex(exported.namedExports.foo$__$bar, /foo--bar_/)
  t.regex(exported.style.$switch$, /switch_/)
  t.regex(exported.namedExports.$switch$, /switch_/)
})

test('combine styles', async t => {
  const { code } = await buildCombinedStyles().catch(err =>
    console.log(err.stack)
  )
  t.true(code.indexOf('"trendy":"_trendy_') > -1)
  t.true(code.indexOf('h1 {') > -1)
})

test('extract styles', async t => {
  await buildWithExtract(true).catch(err => console.log(err.stack))
  const extractedStyles = fs.readFileSync('./output/output_extract.css', 'utf8')
  t.regex(extractedStyles, /color: red;/)
})

test('extract with predefined destination', async t => {
  const dest = './output/dest/extract.css'
  await buildWithExtract(dest).catch(err => console.log(err.stack))
  const extractedStyles = fs.readFileSync(dest, 'utf8')
  t.regex(extractedStyles, /color: red;/)
  t.regex(extractedStyles, /extract.css.map/)
})

test('custom preprocessor', async t => {
  const { code } = await buildWithStylus()
  t.true(code.indexOf('font-size: 14px;') > -1)
})
