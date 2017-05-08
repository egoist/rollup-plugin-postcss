import path from 'path';
import fs from 'fs-promise';
import {createFilter} from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import Concat from 'concat-with-sourcemaps';

function cwd(file) {
  return path.join(process.cwd(), file);
}

function extractCssAndWriteToFile(source, manualDest, autoDest, sourceMap) {
  return Promise.resolve()
    .then(() => {
      if (manualDest) {
        return fs.ensureDir(path.dirname(manualDest));
      }
    })
    .then(() => {
      const fileName = path.basename(autoDest, path.extname(autoDest));
      const cssOutputDest = manualDest ?
        manualDest :
        path.join(path.dirname(autoDest), fileName + '.css');
      let css = source.content.toString('utf8');
      const promises = [];
      if (sourceMap) {
        let map = source.sourceMap;
        if (!manualDest) {
          map = JSON.parse(map);
          map.file = fileName + '.css';
          map = JSON.stringify(map);
        }
        if (sourceMap === 'inline') {
          css += '\n/*# sourceMappingURL=data:application/json;base64,' +
            Buffer.from(map, 'utf8').toString('base64') +
            ' */';
        } else {
          css += `\n/*# sourceMappingURL=${fileName}.css.map */`;
          promises.push(fs.writeFile(`${cssOutputDest}.map`, map));
        }
      }
      promises.push(fs.writeFile(cssOutputDest, css));
      return Promise.all(promises);
    });
}

export default function (options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const injectFnName = '__$styleInject';
  const extensions = options.extensions || ['.css', '.sss'];
  const getExport = options.getExport || function () {};
  const combineStyleTags = Boolean(options.combineStyleTags);
  const extract = Boolean(options.extract);
  const extractPath = typeof options.extract === 'string' ? options.extract : null;

  let concat = null;
  const transformedFiles = {};

  const injectStyleFuncCode = styleInject
    .toString()
    .replace(/styleInject/, injectFnName);

  return {
    intro() {
      if (extract || combineStyleTags) {
        concat = new Concat(
          true,
          path.basename(extractPath || 'styles.css'),
          '\n'
        );
        Object.keys(transformedFiles).forEach(file => {
          concat.add(
            file,
            transformedFiles[file].css,
            transformedFiles[file].map
          );
        });
        if (combineStyleTags) {
          return `${injectStyleFuncCode}\n${injectFnName}(${JSON.stringify(concat.content.toString('utf8'))})`;
        }
      } else {
        return injectStyleFuncCode;
      }
    },
    transform(code, id) {
      if (!filter(id)) {
        return null;
      }
      if (extensions.indexOf(path.extname(id)) === -1) {
        return null;
      }
      const opts = {
        from: options.from ? cwd(options.from) : id,
        to: options.to ? cwd(options.to) : id,
        map: {
          inline: false,
          annotation: false
        },
        parser: options.parser
      };

      return Promise.resolve()
        .then(() => {
          if (options.preprocessor) {
            return options.preprocessor(code, id);
          }
          return {code};
        })
        .then(input => {
          if (input.map && input.map.mappings) {
            opts.map.prev = input.map;
          }
          return postcss(options.plugins || [])
            .process(input.code.replace(/\/\*[@#][\s\t]+sourceMappingURL=.*?\*\/$/mg, ''), opts)
            .then(result => {
              if (combineStyleTags || extract) {
                transformedFiles[result.opts.from] = {
                  css: result.css,
                  map: result.map && result.map.toString()
                };
                return {
                  code: `export default ${JSON.stringify(getExport(result.opts.from))};`,
                  map: {mappings: ''}
                };
              }

              return {
                code: `export default ${injectFnName}(${JSON.stringify(result.css)},${JSON.stringify(getExport(result.opts.from))});`,
                map: options.sourceMap && result.map ?
                  JSON.parse(result.map) :
                  {mappings: ''}
              };
            });
        });
    },
    onwrite(opts) {
      if (extract) {
        return extractCssAndWriteToFile(
          concat,
          extractPath,
          opts.dest,
          options.sourceMap
        );
      }
    }
  };
}
