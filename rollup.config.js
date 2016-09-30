import babel from 'rollup-plugin-babel';

var external = Object.keys( require( './package.json' ).dependencies );

export default {
	entry: 'src/index.js',
	plugins: [
    babel({
      exclude: 'node_modules/**',
      presets: [
        ['es2015', {modules: false}],
        'stage-2'
      ],
      babelrc: false
    })
  ],
	external,
  format: 'cjs'
};
