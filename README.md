# rollup-plugin-postcss

[![NPM version](https://img.shields.io/npm/v/rollup-plugin-postcss.svg?style=flat)](https://npmjs.com/package/rollup-plugin-postcss) [![NPM downloads](https://img.shields.io/npm/dm/rollup-plugin-postcss.svg?style=flat)](https://npmjs.com/package/rollup-plugin-postcss) [![Build Status](https://img.shields.io/circleci/project/egoist/rollup-plugin-postcss/master.svg?style=flat)](https://circleci.com/gh/egoist/rollup-plugin-postcss)
 [![donate](https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&style=flat)](https://github.com/egoist/donate)

<img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg">

Seamless integration between [Rollup](https://github.com/rollup/rollup) and [PostCSS](https://github.com/postcss/postcss).

## Usage

```js
import postcss from 'rollup-plugin-postcss'

export default {
  plugins: [
    postcss()
  ]
}
```

### Extract CSS

```js
postcss({
  extract: true
})
```

### With Sass/Stylus/Less

First add relevant dependency:

```bash
yarn add node-sass --dev
# Now you can import `.sass` and `.scss` files in your library
```

Then enable it in the plugin:

```js
postcss({
  use: [
    ['sass', {/* optional sass options */}]
  ]
})
```

## Options

### use

Type: `name[]` `[name, options][]`

Use a loader.

## License

MIT &copy; [EGOIST](https://github.com/egoist)
