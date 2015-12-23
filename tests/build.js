import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';
import postcss from '../src/index';
import fs from 'fs';

export default function (plugins = []) {
  return new Promise(async (resolve, reject) => {
    await rollup({
      plugins: [
        postcss({
          include: '**/*.css',
          plugins: [
            require('postcss-nested')
          ]
        }),
        babel({
          exclude: '**/*.css',
          sourceMap: true
        }),
      ],
      sourceMap: true,
      entry: __dirname +'/fixture.js'
    }).then(bundle => {
      const result = bundle.generate({
        format: 'umd'
      });
      bundle.write({
        dest: './tests/output.js',
        format: 'umd',
        sourceMap: true
      });
      resolve(result.code);
    }).catch(err => reject(err));
  });
};
