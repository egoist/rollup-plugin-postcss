'use strict';

const createFilter = require('rollup-pluginutils').createFilter;
const postcss = require('postcss');
const path = require('path');

const STYLE_INJECT_PATH = require.resolve('./inject-style');
const INJECT_FN_NAME = '__$injectStyle';

const EMPTY_FN = function() {};

function cwd(file) {
  return path.join(process.cwd(), file);
}

module.exports = function(options = {}) {
  const filter = createFilter(options.include, options.exclude);

  const extensions = options.extensions || ['.css', '.sss'];
  const getExport = options.getExport || EMPTY_FN;

  return {
    transform(code, id) {
      if (!filter(id) || extensions.indexOf(path.extname(id)) < 0) {
        return null;
      }

      const opts = {
        from: options.from ? cwd(options.from) : id,
        to: options.to ? cwd(options.to) : id,
        parser: options.parser
      };

      return postcss(options.plugins || [])
          .process(code, opts)
          .then(result => {
            let code = `
            import ${INJECT_FN_NAME} from ${JSON.stringify(STYLE_INJECT_PATH)};

            ${INJECT_FN_NAME}(${JSON.stringify(result.css)});
            export default ${JSON.stringify(getExport(result.opts.from))};
            `;
            let map = { mappings: '' };
            return { code, map };
          });
    }
  };
};
