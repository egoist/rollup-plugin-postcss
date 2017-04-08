import { createFilter } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';

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

 function extractCssAndWriteToFile(source, manualDest, autoDest, sourceMap){
    const fileName = path.basename(autoDest, path.extname(autoDest));
    const cssOutputDest = manualDest?manualDest:path.join(path.dirname(autoDest), fileName + '.css');
    let css = source.content.toString("utf8");
    let promises = [];
    console.log(fileName);
    if (sourceMap) {
      var map = source.sourceMap;
      if(!manualDest){
        map = JSON.parse(map);
        map.file = fileName + '.css';
        map = JSON.stringify(map);
      }
      if(sourceMap === "inline"){
        css += '\n/*# sourceMappingURL=data:application/json;base64,' + Buffer.from(map, 'utf8').toString('base64') + ' */';
      }else{
        css += `\n//# sourceMappingURL=${fileName}.css.map`;
        promises.push(writeFilePromise(`${cssOutputDest}.map`, map));
      }
    }
    promises.push(writeFilePromise(cssOutputDest, css));
    return Promise.all(promises);
 }

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject'
  const extensions = options.extensions || ['.css', '.sss']
  const getExport = options.getExport || function () {}
  const combineStyleTags = !!options.combineStyleTags;
  const extract = options.extract || false;
  const extractPath = (typeof extract == "string")?extract:false;

  if(extractPath) mkdirp(path.dirname(extractPath), err=>{
      if (err) throw Error(err);
  });

  const concat = new Concat(true, path.basename(extractPath||'styles.css'), '\n');

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
        return extractCssAndWriteToFile(concat, extractPath, opts.dest, options.sourceMap);
      }
    }
  };
};
