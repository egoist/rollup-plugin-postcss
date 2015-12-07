## rollup-plugin-postcss

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
