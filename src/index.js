import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';
import fs from 'fs';

import Concat from 'concat-with-sourcemaps';

function writeFile(dest, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(dest, content, (err) => {
      if(err) return reject(err);

      resolve();
    })
  });
}

function cwd(file) {
  return path.join(process.cwd(), file);
}

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}
  const combineStyleTags = !!options.combineStyleTags;

  const extract = !!options.extract;

  const concat = new Concat(true, 'style.css', '\n');

  const injectStyleFuncCode = styleInject.toString().replace(/styleInject/, injectFnName);

  return {
    intro() {
      if(combineStyleTags) {
        let styles = concat.content.toString('utf8');
        if(options.sourceMap) {
          const map = Buffer.from(concat.sourceMap, 'utf8');
          styles += '\n/*# sourceMappingURL=data:application/json;base64,' +
            map.toString('base64') + ' */';
        }
        return `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(styles)})\n`;
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
            let code;
            let map = { mappings: '' };
            concat.add(result.opts.from, result.css, result.map && result.map.toString());

            if(combineStyleTags) {
              code = `export default ${JSON.stringify(getExport(result.opts.from))};`;
            } else {
              code = `export default ${injectFnName}(${JSON.stringify(result.css)},${JSON.stringify(getExport(result.opts.from))});`;
            }

            return { code, map };
          });
    },
    ongenerate(opts, bundle) {
      if(extract) {
        bundle.css = concat.content.toString('utf8');
        if(opts.sourceMap) {
          bundle.cssMap = concat.sourceMap;
        }
      }
    },
    onwrite(opts, bundle) {
      if(extract) {
        console.log(opts)
        const jsOutputDest = opts.dest;
        const fileName = path.basename(jsOutputDest, path.extname(jsOutputDest));
        const cssOutputDest = path.join(path.dirname(jsOutputDest), fileName + '.css');
        const cssSourceMapOutputDest = cssOutputDest + '.map';

        let css = bundle.css;
        let promises = [];
        if(opts.sourceMap) {
          let map = JSON.parse(bundle.cssMap);
          map.file = fileName + '.css';
          map = JSON.stringify(map);

          if(opts.sourceMap === 'inline') {
            css += '\n/*# sourceMappingURL=data:application/json;base64,' +
              Buffer.from(map, 'utf8').toString('base64') + ' */';
          } else {
            promises.push(writeFile(cssSourceMapOutputDest, map));
            css += `\n/*# sourceMappingURL=${fileName}.css.map */`;
          }
        }
        promises.push(writeFile(cssOutputDest, css))
        return Promise.all(promises);
      }
    }
  };
};
