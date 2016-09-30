import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';
import fs from 'fs';

function cwd(file) {
  return path.join(process.cwd(), file);
}

function extract(mappings, destination) {
  const output = Object.keys(mappings)
    .map(file => mappings[file])
    .join('');
  fs.writeFileSync(destination, output);
}

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}

  const outputMappings = {}

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
            if (options.extract) {
              outputMappings[id] = result.css;
              extract(outputMappings, options.extract);
              return {
                code: `export default ${JSON.stringify(getExport(result.opts.from))}`,
                map: { mappings: '' }
              };
            }
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
