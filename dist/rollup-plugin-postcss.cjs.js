'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var importCwd = _interopDefault(require('import-cwd'));
var postcss = _interopDefault(require('postcss'));
var findPostcssConfig = _interopDefault(require('postcss-load-config'));
var reserved = _interopDefault(require('reserved-words'));
var scopedPlugin = _interopDefault(require('@vue/component-compiler-utils/dist/stylePlugins/scoped'));
var pify = _interopDefault(require('pify'));
var resolve = _interopDefault(require('resolve'));
var PQueue = _interopDefault(require('p-queue'));
var series = _interopDefault(require('promise.series'));
var queryString = _interopDefault(require('querystring'));
var fs = _interopDefault(require('fs-extra'));
var rollupPluginutils = require('rollup-pluginutils');
var Concat = _interopDefault(require('concat-with-sourcemaps'));

const humanlizePath = filepath => path.relative(process.cwd(), filepath);

var normalizePath = (path$$1 => path$$1 && path$$1.replace(/\\+/g, '/'));

const styleInjectPath = require.resolve('style-inject/dist/style-inject.es').replace(/[\\/]+/g, '/');

function loadConfig(id, {
  ctx: configOptions,
  path: configPath
}) {
  const handleError = err => {
    if (err.message.indexOf('No PostCSS Config found') === -1) {
      throw err;
    } // Return empty options for PostCSS


    return {};
  };

  configPath = configPath ? path.resolve(configPath) : path.dirname(id);
  const ctx = {
    file: {
      extname: path.extname(id),
      dirname: path.dirname(id),
      basename: path.basename(id)
    },
    options: configOptions || {}
  };
  return findPostcssConfig(ctx, configPath, {
    argv: false
  }).catch(handleError);
}

function escapeClassNameDashes(str) {
  return str.replace(/-+/g, match => `$${match.replace(/-/g, '_')}$`);
}

function ensureClassName(name) {
  name = escapeClassNameDashes(name);

  if (reserved.check(name)) {
    name = `$${name}$`;
  }

  return name;
}

function ensurePostCSSOption(option) {
  return typeof option === 'string' ? importCwd(option) : option;
}

function isModuleFile(file) {
  return /\.module\.[a-z]{2,6}$/.test(file);
}

var postcssLoader = {
  name: 'postcss',
  alwaysProcess: true,

  // `test` option is dynamically set in ./loaders
  process({
    code,
    map
  }) {
    return new Promise(function ($return, $error) {
      let config, options, plugins, shouldExtract, shouldInject, modulesExported, autoModules, supportModules, postcssOpts, res, outputMap, output, extracted;
      return Promise.resolve(new Promise(function ($return, $error) {
        if (this.options.config) {
          return Promise.resolve(loadConfig(this.id, this.options.config)).then($return, $error);
        }

        return $return({});
      }.bind(this))).then(function ($await_4) {
        try {
          config = $await_4;
          options = this.options;
          plugins = [...(options.postcss.plugins || []), ...(config.plugins || [])];
          shouldExtract = options.extract;
          shouldInject = options.inject;
          modulesExported = {};
          autoModules = options.autoModules !== false && isModuleFile(this.id);
          supportModules = options.modules || autoModules;

          if (supportModules) {
            plugins.push(require('postcss-modules')(Object.assign({
              // In tests
              // Skip hash in names since css content on windows and linux would differ because of `new line` (\r?\n)
              generateScopedName: process.env.ROLLUP_POSTCSS_TEST ? '[name]_[local]' : '[name]_[local]__[hash:base64:5]'
            }, options.modules, {
              getJSON(filepath, json) {
                if (typeof options.modules.getJSON === 'function') {
                  json = options.modules.getJSON(filepath, json);
                }

                modulesExported[filepath] = json;
              }

            })));
          }

          if (options.minimize) {
            plugins.push(require('cssnano')(options.minimize));
          }

          if (this.scoped) {
            plugins.unshift(scopedPlugin(this.scoped));
          }

          postcssOpts = Object.assign({}, this.options.postcss, config.options, {
            // Followings are never modified by user config config
            from: this.id,
            to: this.id,
            map: this.sourceMap ? shouldExtract ? {
              inline: false,
              annotation: false
            } : {
              inline: true,
              annotation: false
            } : false
          });
          delete postcssOpts.plugins;
          postcssOpts.parser = ensurePostCSSOption(postcssOpts.parser);
          postcssOpts.syntax = ensurePostCSSOption(postcssOpts.syntax);
          postcssOpts.stringifier = ensurePostCSSOption(postcssOpts.stringifier);

          if (map && postcssOpts.map) {
            postcssOpts.map.prev = typeof map === 'string' ? JSON.parse(map) : map;
          }

          return Promise.resolve(postcss(plugins).process(code, postcssOpts)).then(function ($await_5) {
            try {
              res = $await_5;
              outputMap = res.map && JSON.parse(res.map.toString());

              if (outputMap && outputMap.sources) {
                outputMap.sources = outputMap.sources.map(v => normalizePath(v));
              }

              output = '';

              if (options.namedExports) {
                let json;
                json = modulesExported[this.id];
                let getClassName;
                getClassName = typeof options.namedExports === 'function' ? options.namedExports : ensureClassName;

                // eslint-disable-next-line guard-for-in
                for (const name in json) {
                  let newName;
                  newName = getClassName(name);

                  // Log transformed class names
                  // But skip this when namedExports is a function
                  // Since a user like you can manually log that if you want
                  if (name !== newName && typeof options.namedExports !== 'function') {
                    console.warn(`Exported "${name}" as "${newName}" in ${humanlizePath(this.id)}`);
                  }

                  if (!json[newName]) {
                    json[newName] = json[name];
                  }

                  output += `export var ${newName} = ${JSON.stringify(json[name])};\n`;
                }
              }

              if (shouldExtract) {
                output += `export default ${JSON.stringify(modulesExported[this.id])};`;
                extracted = {
                  id: this.id,
                  code: res.css,
                  map: outputMap
                };
              } else {
                output += `var css = ${JSON.stringify(res.css)};\nexport default ${supportModules ? JSON.stringify(modulesExported[this.id]) : 'css'};`;
              }

              if (!shouldExtract && shouldInject) {
                output += `\nimport styleInject from '${styleInjectPath}';\nstyleInject(css${Object.keys(options.inject).length > 0 ? `,${JSON.stringify(options.inject)}` : ''});`;
              }

              return $return({
                code: output,
                map: outputMap,
                extracted
              });
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }.bind(this), $error);
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }.bind(this), $error);
    }.bind(this));
  }

};

// See: https://github.com/sass/node-sass/issues/857

const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
const workQueue = new PQueue({
  concurrency: threadPoolSize - 1
});
const moduleRe = /^~([a-z0-9]|@).+/i;

const getUrlOfPartial = url => {
  const parsedUrl = path.parse(url);
  return `${parsedUrl.dir}${path.sep}_${parsedUrl.base}`;
};

const resolvePromise = pify(resolve);
var sassLoader = {
  name: 'sass',
  test: /\.s[ac]ss$/,

  process({
    code
  }) {
    return new Promise(function ($return, $error) {
      const sass = importCwd('node-sass');
      return $return(new Promise((resolve$$1, reject) => {
        workQueue.add(() => pify(sass.render.bind(sass))(Object.assign({}, this.options, {
          file: this.id,
          data: code,
          indentedSyntax: /\.sass$/.test(this.id),
          sourceMap: this.sourceMap,
          importer: [(url, importer, done) => {
            if (!moduleRe.test(url)) return done({
              file: url
            });
            const moduleUrl = url.slice(1);
            const partialUrl = getUrlOfPartial(moduleUrl);
            const options = {
              basedir: path.dirname(importer),
              extensions: ['.scss', '.sass', '.css']
            };

            const finishImport = id => {
              done({
                // Do not add `.css` extension in order to inline the file
                file: id.endsWith('.css') ? id.replace(/\.css$/, '') : id
              });
            };

            const next = () => {
              // Catch all resolving errors, return the original file and pass responsibility back to other custom importers
              done({
                file: url
              });
            }; // Give precedence to importing a partial


            resolvePromise(partialUrl, options).then(finishImport).catch(err => {
              if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ENOENT') {
                resolvePromise(moduleUrl, options).then(finishImport).catch(next);
              } else {
                next();
              }
            });
          }].concat(this.options.importer || [])
        })).then(res => resolve$$1({
          code: res.css.toString(),
          map: res.map && res.map.toString()
        })).catch(reject));
      }));
    });
  }

};

var stylusLoader = {
  name: 'stylus',
  test: /\.(styl|stylus)$/,

  process({
    code
  }) {
    return new Promise(function ($return, $error) {
      let stylus, style, css;
      stylus = importCwd('stylus');
      style = stylus(code, Object.assign({}, this.options, {
        filename: this.id,
        sourcemap: this.sourceMap && {}
      }));
      return Promise.resolve(pify(style.render.bind(style))()).then(function ($await_1) {
        try {
          css = $await_1;
          return $return({
            code: css,
            map: style.sourcemap
          });
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  }

};

var lessLoader = {
  name: 'less',
  test: /\.less$/,

  process({
    code
  }) {
    return new Promise(function ($return, $error) {
      let less, _ref, css, map;

      less = importCwd('less');
      return Promise.resolve(pify(less.render.bind(less))(code, Object.assign({}, this.options, {
        sourceMap: this.sourceMap && {},
        filename: this.id
      }))).then(function ($await_1) {
        try {
          _ref = $await_1, css = _ref.css, map = _ref.map;

          if (map) {
            map = JSON.parse(map);
            map.sources = map.sources.map(source => humanlizePath(source));
          }

          return $return({
            code: css,
            map
          });
        } catch ($boundEx) {
          return $error($boundEx);
        }
      }, $error);
    }.bind(this));
  }

};

const matchFile = (filepath, condition) => {
  if (typeof condition === 'function') {
    return condition(filepath);
  }

  return condition && condition.test(filepath);
};

class Loaders {
  constructor(options = {}) {
    this.use = options.use.map(rule => {
      if (typeof rule === 'string') {
        return [rule];
      }

      if (Array.isArray(rule)) {
        return rule;
      }

      throw new TypeError('The rule in `use` option must be string or Array!');
    });
    this.loaders = [];
    const extensions = options.extensions || ['.css', '.sss', '.pcss'];

    postcssLoader.test = filepath => extensions.some(ext => path.extname(filepath) === ext);

    this.registerLoader(postcssLoader);
    this.registerLoader(sassLoader);
    this.registerLoader(stylusLoader);
    this.registerLoader(lessLoader);

    if (options.loaders) {
      options.loaders.forEach(loader => this.registerLoader(loader));
    }
  }

  registerLoader(loader) {
    const existing = this.getLoader(loader.name);

    if (existing) {
      this.removeLoader(loader.name);
    }

    this.loaders.push(loader);
    return this;
  }

  removeLoader(name) {
    this.loaders = this.loaders.filter(loader => loader.name !== name);
    return this;
  }

  isSupported(filepath) {
    return this.loaders.some(loader => {
      return matchFile(filepath, loader.test);
    });
  }

  process({
    code,
    map,
    id,
    sourceMap,
    scoped
  }) {
    return series(this.use.slice().reverse().map(([name, options]) => {
      const loader = this.getLoader(name);
      const loaderContext = {
        options: options || {},
        id,
        sourceMap,
        scoped
      };
      return v => {
        if (loader.alwaysProcess || matchFile(id, loader.test)) {
          return loader.process.call(loaderContext, v);
        } // Otherwise directly return input value


        return v;
      };
    }), {
      code,
      map
    });
  }

  getLoader(name) {
    return this.loaders.find(loader => loader.name === name);
  }

}

/**
 * The options that could be `boolean` or `object`
 * We convert it to an object when it's truthy
 * Otherwise fallback to default value
 */

function inferOption(option, defaultValue) {
  if (option === false) return false;
  if (option && typeof option === 'object') return option;
  return option ? {} : defaultValue;
}

const QUERY_REGEXP = /\?(.+)$/;

function hasQuery(str) {
  return QUERY_REGEXP.test(str);
}

function parseQuery(str) {
  return queryString.parse(QUERY_REGEXP.exec(str)[1]);
}

function stripQuery(str) {
  return str.replace(QUERY_REGEXP, '');
}

var index = ((options = {}) => {
  const filter = rollupPluginutils.createFilter(options.include, options.exclude);
  const sourceMap = options.sourceMap;
  const postcssLoaderOptions = {
    /** Inject CSS as `<style>` to `<head>` */
    inject: inferOption(options.inject, {}),

    /** Extract CSS */
    extract: typeof options.extract === 'undefined' ? false : options.extract,

    /** CSS modules */
    modules: inferOption(options.modules, false),
    namedExports: options.namedExports,

    /** Automatically CSS modules for .module.xxx files */
    autoModules: options.autoModules,

    /** Options for cssnano */
    minimize: inferOption(options.minimize, false),

    /** Postcss config file */
    config: inferOption(options.config, {}),

    /** PostCSS options */
    postcss: {
      parser: options.parser,
      plugins: options.plugins,
      syntax: options.syntax,
      stringifier: options.stringifier,
      exec: options.exec
    }
  };
  const use = options.use || ['sass', 'stylus', 'less'];
  use.unshift(['postcss', postcssLoaderOptions]);
  const loaders = new Loaders({
    use,
    loaders: options.loaders,
    extensions: options.extensions
  });
  const extracted = new Map();
  return {
    name: 'postcss',

    resolveId(id, importer) {
      if (importer && hasQuery(id)) {
        return path.resolve(path.dirname(importer), id);
      }
    },

    load(id) {
      return new Promise(function ($return, $error) {
        if (hasQuery(id)) {
          let _parseQuery, start, end, file, bareId, content;

          _parseQuery = parseQuery(id), start = _parseQuery.start, end = _parseQuery.end, file = _parseQuery.file;
          bareId = stripQuery(id);
          return Promise.resolve(fs.readFile(file ? path.resolve(path.dirname(bareId), file) : bareId, 'utf8')).then(function ($await_5) {
            try {
              content = $await_5;
              return $return(start && end ? content.slice(Number(start), Number(end)) : content);
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        }

        return $return();
      });
    },

    transform(code, id) {
      return new Promise(function ($return, $error) {
        let scoped, res;

        if (hasQuery(id)) {
          let query;
          query = parseQuery(id);
          scoped = query.scoped;
          id = stripQuery(id);
        }

        if (!filter(id) || !loaders.isSupported(id)) {
          return $return(null);
        }

        if (typeof options.onImport === 'function') {
          options.onImport(id);
        }

        return Promise.resolve(loaders.process({
          code,
          map: undefined,
          id,
          sourceMap,
          scoped
        })).then(function ($await_6) {
          try {
            res = $await_6;

            if (postcssLoaderOptions.extract) {
              extracted.set(id, res.extracted);
              return $return({
                code: res.code,
                map: {
                  mappings: ''
                }
              });
            }

            return $return({
              code: res.code,
              map: res.map || {
                mappings: ''
              }
            });
          } catch ($boundEx) {
            return $error($boundEx);
          }
        }, $error);
      });
    },

    onwrite(opts) {
      return new Promise(function ($return, $error) {
        let getExtracted, _getExtracted, code, codeFilePath, map, mapFilePath;

        if (extracted.size === 0) return $return();
        getExtracted = filepath => {
          if (!filepath) {
            if (typeof postcssLoaderOptions.extract === 'string') {
              filepath = postcssLoaderOptions.extract;
            } else {
              const basename = path.basename(opts.file, path.extname(opts.file));
              filepath = path.join(path.dirname(opts.file), basename + '.css');
            }
          }

          filepath = humanlizePath(filepath);
          const concat = new Concat(true, filepath, '\n');
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = extracted.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              const res = _step.value;
              const relative = humanlizePath(res.id);
              const map = res.map || null;

              if (map) {
                map.file = filepath;
                map.sources = map.sources.map(source => humanlizePath(path.join(path.dirname(opts.file), source)));
              }

              concat.add(relative, res.code, map);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }

          let code = concat.content;

          if (sourceMap === 'inline') {
            code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(concat.sourceMap, 'utf8').toString('base64')}*/`;
          } else if (sourceMap === true) {
            code += `\n/*# sourceMappingURL=${path.basename(filepath)}.map */`;
          }

          return {
            code,
            map: sourceMap === true && concat.sourceMap,
            codeFilePath: filepath,
            mapFilePath: filepath + '.map'
          };
        };

        if (options.onExtract) {
          let shouldExtract;
          return Promise.resolve(options.onExtract(getExtracted)).then(function ($await_7) {
            try {
              shouldExtract = $await_7;

              if (shouldExtract === false) {
                return $return();
              }

              return $If_4.call(this);
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }.bind(this), $error);
        }

        function $If_4() {
          _getExtracted = getExtracted(), code = _getExtracted.code, codeFilePath = _getExtracted.codeFilePath, map = _getExtracted.map, mapFilePath = _getExtracted.mapFilePath;
          return Promise.resolve(fs.ensureDir(path.dirname(codeFilePath)).then(() => Promise.all([fs.writeFile(codeFilePath, code, 'utf8'), sourceMap === true && fs.writeFile(mapFilePath, map, 'utf8')]))).then(function ($await_8) {
            try {
              return $return();
            } catch ($boundEx) {
              return $error($boundEx);
            }
          }, $error);
        }

        return $If_4.call(this);
      });
    }

  };
});

module.exports = index;
