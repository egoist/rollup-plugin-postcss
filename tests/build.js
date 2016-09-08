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

export function buildWithCssModules() {
  const exportMap = {}
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        plugins: [
          require('postcss-modules')({
            getJSON (id, exportTokens) {
              exportMap[id] = exportTokens;
            }
          })
        ],
        getExport (id) {
          return exportMap[id];
        }
      }),
      babel({
        babelrc: false,
        presets: ['es2015-rollup'],
        include: '**/*.js',
        sourceMap: true
      }),
    ],
    entry: __dirname +'/fixture_modules.js'
  }).then(bundle => {
    const result = bundle.generate({
      format: 'umd',
      moduleName: 'default',
      sourceMap: true,
    });
    bundle.write({
      dest: './tests/output_modules.js',
      moduleName: 'default',
      format: 'umd',
      sourceMap: true
    });
    return result.code;
  })
};

export function buildWithExtract() {
  return rollup({
    plugins: [
      postcss({
        include: '**/*.css',
        sourceMap: true,
        extract: './tests/output.css',
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
  })
}
