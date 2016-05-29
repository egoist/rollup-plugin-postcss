import fs from 'fs';
import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';
import postcss from '../src/index';
import sugarss from 'sugarss';

export function buildDefault() {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        plugins: [
          require('postcss-nested')
        ]
      }),
      babel({
        babelrc: false,
        presets: ['es2015-rollup'],
        include: '**/*.js',
        sourceMap: true
      }),
    ],
    entry: __dirname +'/fixture.js'
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      sourceMap: true,
    });
    bundle.write({
      dest: './tests/output.js',
      format: 'umd',
      sourceMap: true
    });
    return result.code;
  })
};

export function buildWithParser() {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.sss',
        sourceMap: true,
        parser: sugarss,
        plugins: [
          require('postcss-nested')
        ]
      }),
      babel({
        babelrc: false,
        presets: ['es2015-rollup'],
        include: '**/*.js',
        sourceMap: true
      }),
    ],
    entry: __dirname +'/fixture_parser.js'
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      sourceMap: true,
    });
    bundle.write({
      dest: './tests/output_parser.js',
      format: 'umd',
      sourceMap: true
    });
    return result.code;
  })
};
