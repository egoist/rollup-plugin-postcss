import test from 'ava';
import fs from 'fs';
import requireFromString from 'require-from-string';
import {
  buildDefault,
  buildWithParser,
  buildWithCssModules,
  buildWithExtract
} from './tests/build';

test('test postcss', async t => {
  const data = await buildDefault().catch(err => console.log(err.stack));
  requireFromString(data);
  const styles = window.getComputedStyle(document.body);
  t.is(styles.margin, '0px');
});

test('use sugarss as parser', async t => {
  const data = await buildWithParser().catch(err => console.log(err.stack));
  requireFromString(data);
  const styles = window.getComputedStyle(document.body);
  t.is(styles.fontSize, '20px');
});

test('use cssmodules', async t => {
  const data = await buildWithCssModules().catch(err => console.log(err.stack));
  const exported = requireFromString(data);
  t.regex(exported.trendy, /trendy_/);
})

test('use extract', async t => {
  const data = await buildWithExtract().catch(err => console.log(err.stack));
  const extractedStyles = fs.readFileSync('./tests/output.css');
  t.regex(extractedStyles, /margin/);
})
