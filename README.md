# rollup-plugin-postcss 

[![NPM version](https://img.shields.io/npm/v/rollup-plugin-postcss.svg?style=flat)](https://npmjs.com/package/rollup-plugin-postcss) [![NPM downloads](https://img.shields.io/npm/dm/rollup-plugin-postcss.svg?style=flat)](https://npmjs.com/package/rollup-plugin-postcss) [![Build Status](https://img.shields.io/circleci/project/egoist/rollup-plugin-postcss/master.svg?style=flat)](https://circleci.com/gh/egoist/rollup-plugin-postcss)
 [![donate](https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&style=flat)](https://github.com/egoist/donate)

<img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg">

Seamless integration between [Rollup](https://github.com/rollup/rollup) and [PostCSS](https://github.com/postcss/postcss).

## Features

- CSS modules support
- Extract CSS file
- Custom pre-processor support (like Stylus and Sass)

## Installation

```bash
yarn add rollup-plugin-postcss --dev
```

## Examples

### Basic

**config**

```javascript
import postcss from 'rollup-plugin-postcss';

export default {
  entry: 'main.js',
  plugins: [
    postcss({
      plugins: [
        // cssnext(),
        // yourPostcssPlugin()
      ],
      //sourceMap: false, // default value
      //extract: false, // default value
      extensions: ['.css', '.sss']  // default value
      // parser: sugarss
    })
  ]
}
```

**entry**

```javascript
import '/path/to/some_random_file.css';
```

### Use with CSS modules

The [postcss-modules](https://github.com/css-modules/postcss-modules) plugin allows you to use CSS modules in PostCSS, it requires some additional setup to use in Rollup:

```js
import postcss from 'rollup-plugin-postcss';
import postcssModules from 'postcss-modules';

const cssExportMap = {};

export default {
 plugins: [
    postcss({
      plugins: [
        postcssModules({
          getJSON (id, exportTokens) {
            cssExportMap[id] = exportTokens;
          }
        })
      ],
      getExport (id) {
        return cssExportMap[id];
      }
    })
 ]
}
```

That's it, you can now use CSS modules and import CSS like this:

```js
import style from './style.css';

console.log(style.className); // .className_echwj_1
```
You also can import only a specific CSS className like this:

```js
import {className} from './style.css';

console.log(className); // .className_echwj_2
```

### Extract CSS

```js
import postcss from 'rollup-plugin-postcss';

export default {
  plugins: [
    postcss({
      sourceMap: true, // true, "inline" or false
      extract : '/path/to/style.css'
    })
  ]
}
```

When `extract` is set to `true` the plugin will automatically generate a css file in the same place where the js is created by rollup. The css file will have the same name as the js file.

### Minimize

Simply use the [cssnano](http://cssnano.co/) plugin:

```js
import postcss from 'rollup-plugin-postcss';
import cssnano from 'cssnano';

export default {
  plugins: [
    postcss({
      plugins: [cssnano()]
    })
  ]
}
```

### Custom pre-processor

For example, you want to run `stylus` or `sass` before `postcss`:

```js
import postcss from 'rollup-plugin-postcss';
import stylus from 'stylus';

const preprocessor = (content, id) => new Promise((resolve, reject) => {
  const renderer = stylus(content, {
    filename: id,
    sourcemap: {inline: true}
  });
  renderer.render((err, code) => {
    if (err) {
      return reject(err);
    }
    resolve({code, map: renderer.sourcemap});
  });
});

export default {
  plugins: [
    postcss({
      preprocessor,
      extensions: ['.styl']
    })
  ]
}
```

Then you can `import './your-stylus.styl'`!

## License

MIT &copy; [EGOIST](https://github.com/egoist)
