# rollup-plugin-postcss [![Build Status](https://img.shields.io/circleci/project/egoist/rollup-plugin-postcss/master.svg?style=flat-square)](https://circleci.com/gh/egoist/rollup-plugin-postcss/tree/master)

<img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg">

Seamless integration between [Rollup](https://github.com/rollup/rollup) and [PostCSS](https://github.com/postcss/postcss).

## Installation

```bash
npm install rollup-plugin-postcss
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
      ]
    })
  ]
}).then(...)
```

**entry**

```javascript
import '/path/to/some_random_file.css'
```

## License

MIT &copy; [EGOIST](https://github.com/egoist)
