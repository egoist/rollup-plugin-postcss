import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';
import fs from 'fs';

import Concat from 'concat-with-sourcemaps';

function cwd(file) {
  return path.join(process.cwd(), file);
}

function writeFilePromise(dest, content) {
   return new Promise((resolve, reject) => {
     fs.writeFile(dest, content, (err) => {
       if(err) return reject(err);
 
       resolve();
     })
   });
 }

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}
  const combineStyleTags = !!options.combineStyleTags;
  const extract = typeof options.extract === 'string' ? options.extract : false;

  const concat = new Concat(true, path.basename(extract || 'styles.css'), '\n');

  const injectStyleFuncCode = styleInject.toString().replace(/styleInject/, injectFnName);

  return {
    intro() {
      if(extract) return;
      if(combineStyleTags) return `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(concat.content.toString('utf8'))})`;
      return injectStyleFuncCode;
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
            if(combineStyleTags || extract) {
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
    },
    onwrite(opts){
      if(extract){
        let css = concat.content.toString("utf8");
        if (options.sourceMap) {
          css += '\n/*# sourceMappingURL=data:application/json;base64,' + Buffer.from(concat.sourceMap, 'utf8').toString('base64') + ' */';
        }
        return writeFilePromise(extract, css);
      }
    }
  };
};
