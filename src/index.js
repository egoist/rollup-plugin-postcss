import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';

import Concat from 'concat-with-sourcemaps';

function cwd(file) {
  return path.join(process.cwd(), file);
}

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}
  const combineStyleTags = !!options.combineStyleTags;

  const concat = new Concat(true, 'styles.css', '\n');

  const injectStyleFuncCode = styleInject.toString().replace(/styleInject/, injectFnName);

  return {
    intro() {
      if(combineStyleTags) {
        return `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(concat.content.toString('utf8'))})`;
      } else {
        return injectStyleFuncCode;
      }
    },
    transform(code, id) {
      if (!filter(id)) return null
      if (extensions.indexOf(path.extname(id)) === -1) return null
      const opts = {
        from: options.from ? cwd(options.from) : id,
        to: options.to ? cwd(options.to) : id,
        map: {
          inline: false,
          annotation: false
        },
        parser: options.parser
      };
      return postcss(options.plugins || [])
          .process(code, opts)
          .then(result => {
            let code, map;
            if(combineStyleTags) {
              concat.add(result.opts.from, result.css, result.map && result.map.toString());
              code = `export default ${JSON.stringify(getExport(result.opts.from))};`;
              map = { mappings: '' };
            } else {
              code = `export default ${injectFnName}(${JSON.stringify(result.css)},${JSON.stringify(getExport(result.opts.from))});`;
              map = options.sourceMap && result.map
                ? JSON.parse(result.map)
                : { mappings: '' };
            }

            return { code, map };
          });
    }
  };
};
