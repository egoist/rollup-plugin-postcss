import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';

function cwd(file) {
  return path.join(process.cwd(), file);
}

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}

  return {
    intro() {
      return styleInject.toString().replace(/styleInject/, injectFnName);
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
            const code = `export default ${injectFnName}(${JSON.stringify(result.css)},${JSON.stringify(getExport(result.opts.from))});`;
            const map = options.sourceMap && result.map
              ? JSON.parse(result.map)
              : { mappings: '' };
            return {
              code,
              map
            };
          });
    }
  };
};
