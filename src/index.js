import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';

function pathJoin (file) {
  return path.join(process.cwd(), file);
}

export default function (options = {}) {
  const filter = createFilter( options.include, options.exclude );
  const injectFnName = '__$styleInject'
  return {
    intro () {
      return styleInject.toString().replace(/styleInject/, injectFnName);
    },
    transform (code, id) {
      if (!filter( id ) || id.slice( -4 ) !== '.css') {
        return null;
      }
      const opts = {
        from: options.from ? pathJoin(options.from) : id,
        to: options.to ? pathJoin(options.to) : id,
        map: {
          inline:     false,
          annotation: false
        }
      };
      return new Promise((resolve, reject) => {
        postcss(options.plugins || [])
          .process(code, opts)
          .then(result => {
            result.css = `export default ${injectFnName}(${JSON.stringify(result.css)});`
            resolve({
              code: result.css,
              map: result.map
            });
          })
          .catch(err => reject(err));
      });
    }
  };
};
