# rollup-plugin-postcss [![Build Status](https://img.shields.io/circleci/project/egoist/rollup-plugin-postcss/master.svg?style=flat-square)](https://circleci.com/gh/egoist/rollup-plugin-postcss/tree/master)

<img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg">

Seamless integration between [Rollup](https://github.com/rollup/rollup) and [PostCSS](https://github.com/postcss/postcss).

## Installation

```bash
npm install rollup-plugin-postcss --dev
```

## Example

**config**

```javascript
import { rollup } from 'rollup';
import postcss from 'rollup-plugin-postcss';

rollup({
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
}).then(() => {})
```

**entry**

```javascript
import '/path/to/some_random_file.css';
```

## Use with CSS modules

The [postcss-modules](https://github.com/css-modules/postcss-modules) plugin allows you to use CSS modules in PostCSS, it requires some additional setup to use in Rollup:

```js
import postcss from 'rollup-plugin-postcss';
import postcssModules from 'postcss-modules';

const cssExportMap = {};

rollup({
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
});
```

That's it, you can now use CSS modules and import CSS like this:

```js
import style from './style.css';

console.log(style.className); // .className_echwj_1
```

## Extract CSS

```js
import postcss from 'rollup-plugin-postcss';

rollup({
 plugins: [
    postcss({
      sourceMap: true, // true, "inline" or false
      extract : '/path/to/style.css'
    })
 ]
});
```

When `extract` is set to `true` the plugin will automatically generate a css file in the same place where the js is created by rollup. The css file will have the same name as the js file.

## License

MIT &copy; [EGOIST](https://github.com/egoist)
