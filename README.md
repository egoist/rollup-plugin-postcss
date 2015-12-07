## rollup-plugin-postcss [![Build Status](https://img.shields.io/circleci/project/egoist/rollup-plugin-postcss/master.svg?style=flat-square)](https://circleci.com/gh/egoist/rollup-plugin-postcss/tree/master)

Seamless integration between Rollup and PostCSS.

## Installation

```bash
npm install rollup-plugin-postcss
```

## Example

**rollup.config.js**

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
