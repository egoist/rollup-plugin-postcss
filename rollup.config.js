import babel from 'rollup-plugin-babel';

const external = Object.keys( require( './package.json' ).dependencies ) ;

export default {
	entry: 'src/index.js',
	plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ],
	external,
  format: 'cjs'
};
