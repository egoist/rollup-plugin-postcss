import fs from 'fs'
import test from 'ava'
import requireFromString from 'require-from-string'
import rm from 'rimraf'
import {
  buildDefault,
  buildWithParser,
  buildWithCssModules,
  buildWithCssModulesEscapingDashes,
  buildWithCssModulesEscapingDashesExportNamed,
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
  const data = await buildDefault().catch(err => console.log(err.stack))
  requireFromString(data)
  const styles = window.getComputedStyle(document.body)
  t.is(styles.margin, '0px')
})

test('use sugarss as parser', async t => {
  const data = await buildWithParser().catch(err => console.log(err.stack))
  requireFromString(data)
  const styles = window.getComputedStyle(document.body)
  t.is(styles.fontSize, '20px')
})

test('use cssmodules', async t => {
  const data = await buildWithCssModules().catch(err => console.log(err.stack))
  const exported = requireFromString(data)
  t.regex(exported.styleDefault.trendy, /trendy_/)
  t.regex(exported.styleDefault['foo-bar'], /foo-bar_/)
})

test('use cssmodules with escaped dashes', async t => {
  const data = await buildWithCssModulesEscapingDashes().catch(err =>
    console.log(err.stack)
  )
  const exported = requireFromString(data)
  t.regex(exported.styleDefault.trendy, /trendy_/)
  t.regex(exported.styleDefault.fooBar, /foo-bar_/)
})

test('use cssmodules with escaped dashes and named exports', async t => {
  const data = await buildWithCssModulesEscapingDashesExportNamed().catch(err =>
    console.log(err.stack)
  )
  const exported = requireFromString(data)
  t.regex(exported.styleDefault.trendy, /trendy_/)
  t.regex(exported.styleDefault.fooBar, /foo-bar_/)
  t.regex(exported.styleAll.fooBar, /foo-bar_/)
})

test('combine styles', async t => {
  const data = await buildCombinedStyles().catch(err => console.log(err.stack))
  requireFromString(data)
  const styles = window.getComputedStyle(document.body)
  t.is(styles.margin, '0px')
  t.is(styles.fontSize, '20px')
})

test('extract styles', async t => {
  await buildWithExtract().catch(err => console.log(err.stack))
  const extractedStyles = fs.readFileSync('./output/output_extract.css', 'utf8')
  t.regex(extractedStyles, /color: red;/)
})

test('custom preprocessor', async t => {
  const { code } = await buildWithStylus()
  t.true(code.indexOf('font-size: 14px;') > -1)
})
