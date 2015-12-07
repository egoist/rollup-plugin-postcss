import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';
import postcss from '../src/index';
import fs from 'fs';

export default function () {
  return new Promise(async (resolve, reject) => {
    await rollup({
      plugins: [
        postcss({
          include: '**/*.css'
        }),
        babel({
          exclude: '**/*.css'
        }),
      ],
      entry: __dirname +'/fixture.js'
    }).then(bundle => {
      const result = bundle.generate({
        format: 'umd'
      });
      resolve(result.code);
    }).catch(err => reject(err));
  });
};
