'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var rollupPluginutils = require('rollup-pluginutils');
var Concat = _interopDefault(require('concat-with-sourcemaps'));
var series = _interopDefault(require('promise.series'));
var importCwd = _interopDefault(require('import-cwd'));
var postcss = _interopDefault(require('postcss'));
var findPostcssConfig = _interopDefault(require('postcss-load-config'));
var reserved = _interopDefault(require('reserved-words'));
var pify = _interopDefault(require('pify'));
var resolve = _interopDefault(require('resolve'));
var PQueue = _interopDefault(require('p-queue'));

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

var normalizePath = (path => path && path.replace(/\\+/g, '/'));

const humanlizePath = filepath => normalizePath(path.relative(process.cwd(), filepath));

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
  return findPostcssConfig(ctx, configPath).catch(handleError);
}

function escapeClassNameDashes(str) {
  return str.replace(/-+/g, match => {
    return `$${match.replace(/-/g, '_')}$`;
  });
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
    var _this = this;

    return _asyncToGenerator(function* () {
      const config = _this.options.config ? yield loadConfig(_this.id, _this.options.config) : {};
      const options = _this.options;
      const plugins = [...(options.postcss.plugins || []), ...(config.plugins || [])];
      const shouldExtract = options.extract;
      const shouldInject = options.inject;
      const manualInjectName = (typeof options.manualInjectName === 'function' ? options.manualInjectName(_this.id) : options.manualInjectName) || '';
      const modulesExported = {};
      const autoModules = options.autoModules !== false && isModuleFile(_this.id);
      const supportModules = options.modules || autoModules;

      if (supportModules) {
        plugins.push(require('postcss-modules')(_objectSpread2({
          // In tests
          // Skip hash in names since css content on windows and linux would differ because of `new line` (\r?\n)
          generateScopedName: process.env.ROLLUP_POSTCSS_TEST ? '[name]_[local]' : '[name]_[local]__[hash:base64:5]'
        }, options.modules, {
          getJSON(filepath, json, outpath) {
            modulesExported[filepath] = json;

            if (typeof options.modules === 'object' && typeof options.modules.getJSON === 'function') {
              return options.modules.getJSON(filepath, json, outpath);
            }
          }

        })));
      } // If shouldExtract, minimize is done after all CSS are extracted to a file


      if (!shouldExtract && options.minimize) {
        plugins.push(require('cssnano')(options.minimize));
      }

      const postcssOpts = _objectSpread2({}, _this.options.postcss, {}, config.options, {
        // Followings are never modified by user config config
        from: _this.id,
        to: _this.id,
        map: _this.sourceMap ? shouldExtract ? {
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

      if (plugins.length === 0) {
        // Prevent from postcss warning:
        // You did not set any plugins, parser, or stringifier. Right now, PostCSS does nothing. Pick plugins for your case on https://www.postcss.parts/ and use them in postcss.config.js
        const noopPlugin = postcss.plugin('postcss-noop-plugin', () => () => {
          /* noop */
        });
        plugins.push(noopPlugin());
      }

      const res = yield postcss(plugins).process(code, postcssOpts);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = res.messages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          const msg = _step.value;

          if (msg.type === 'dependency') {
            _this.dependencies.add(msg.file);
          }
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

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = res.warnings()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          const warning = _step2.value;

          _this.warn(warning);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      const outputMap = res.map && JSON.parse(res.map.toString());

      if (outputMap && outputMap.sources) {
        outputMap.sources = outputMap.sources.map(v => normalizePath(v));
      }

      let output = '';
      let extracted;

      if (options.namedExports) {
        const json = modulesExported[_this.id];
        const getClassName = typeof options.namedExports === 'function' ? options.namedExports : ensureClassName; // eslint-disable-next-line guard-for-in

        for (const name in json) {
          const newName = getClassName(name); // Log transformed class names
          // But skip this when namedExports is a function
          // Since a user like you can manually log that if you want

          if (name !== newName && typeof options.namedExports !== 'function') {
            _this.warn(`Exported "${name}" as "${newName}" in ${humanlizePath(_this.id)}`);
          }

          if (!json[newName]) {
            json[newName] = json[name];
          }

          output += `export var ${newName} = ${JSON.stringify(json[name])};\n`;
        }
      }

      if (shouldExtract) {
        output += `export default ${JSON.stringify(modulesExported[_this.id])};`;
        extracted = {
          id: _this.id,
          code: res.css,
          map: outputMap
        };
      } else {
        output += `var css = ${JSON.stringify(res.css)};\nexport default ${supportModules ? JSON.stringify(modulesExported[_this.id]) : 'css'};`;

        if (manualInjectName || shouldInject) {
          output += `\nimport styleInject from '${styleInjectPath}';\n`;
          const injectOptsStr = Object.keys(options.inject).length > 0 ? `,${JSON.stringify(options.inject)}` : '';

          if (manualInjectName) {
            output += `var refs = 0;
          
          export function ${manualInjectName}() {
            if (!(refs++)) {
              styleInject(css${injectOptsStr});
            }
          }
          `;
          } else {
            output += `styleInject(css${injectOptsStr});`;
          }
        }
      }

      return {
        code: output,
        map: outputMap,
        extracted
      };
    })();
  }

};

function loadModule(moduleId) {
  // Trying to load module normally (relative to plugin directory)
  try {
    return require(moduleId);
  } catch (err) {} // Ignore error
  // Then, trying to load it relative to CWD


  return importCwd.silent(moduleId);
}

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

const resolvePromise = pify(resolve); // List of supported SASS modules in the order of preference

const sassModuleIds = ['node-sass', 'sass'];
var sassLoader = {
  name: 'sass',
  test: /\.(sass|scss)$/,

  process({
    code
  }) {
    return new Promise((resolve, reject) => {
      const sass = loadSassOrThrow();
      const render = pify(sass.render.bind(sass));
      return workQueue.add(() => render(_objectSpread2({}, this.options, {
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
      })).then(res => {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = res.stats.includedFiles[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            const file = _step.value;
            this.dependencies.add(file);
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

        resolve({
          code: res.css.toString(),
          map: res.map && res.map.toString()
        });
      }).catch(reject));
    });
  }

};

function loadSassOrThrow() {
  // Loading one of the supported modules
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = sassModuleIds[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      const moduleId = _step2.value;
      const module = loadModule(moduleId);

      if (module) {
        return module;
      }
    } // Throwing exception if module can't be loaded

  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  throw new Error(`You need to install one of the following packages: ` + sassModuleIds.map(moduleId => `"${moduleId}"`).join(', ') + ' ' + `in order to process SASS files`);
}

var stylusLoader = {
  name: 'stylus',
  test: /\.(styl|stylus)$/,

  process({
    code
  }) {
    var _this = this;

    return _asyncToGenerator(function* () {
      const stylus = loadModule('stylus');

      if (!stylus) {
        throw new Error(`You need to install "stylus" packages in order to process Stylus files`);
      }

      const style = stylus(code, _objectSpread2({}, _this.options, {
        filename: _this.id,
        sourcemap: _this.sourceMap && {}
      }));
      const css = yield pify(style.render.bind(style))();
      const deps = style.deps();
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = deps[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          const dep = _step.value;

          _this.dependencies.add(dep);
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

      return {
        code: css,
        map: style.sourcemap
      };
    })();
  }

};

var lessLoader = {
  name: 'less',
  test: /\.less$/,

  process({
    code
  }) {
    var _this = this;

    return _asyncToGenerator(function* () {
      const less = loadModule('less');

      if (!less) {
        throw new Error(`You need to install "less" packages in order to process Less files`);
      }

      let _ref = yield pify(less.render.bind(less))(code, _objectSpread2({}, _this.options, {
        sourceMap: _this.sourceMap && {},
        filename: _this.id
      })),
          css = _ref.css,
          map = _ref.map,
          imports = _ref.imports;

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = imports[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          const dep = _step.value;

          _this.dependencies.add(dep);
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

      if (map) {
        map = JSON.parse(map);
        map.sources = map.sources.map(source => humanlizePath(source));
      }

      return {
        code: css,
        map
      };
    })();
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
  /**
   * Process the resource with loaders in serial
   * @param {object} resource
   * @param {string} resource.code
   * @param {any} resource.map
   * @param {object} context
   * @param {string} context.id The absolute path to resource
   * @param {boolean | 'inline'} context.sourceMap
   * @param {Set<string>} context.dependencies A set of dependencies to watch
   * @returns {{code: string, map?: any}}
   */


  process({
    code,
    map
  }, context) {
    return series(this.use.slice().reverse().map(([name, options]) => {
      const loader = this.getLoader(name);
      const loaderContext = Object.assign({
        options: options || {}
      }, context);
      return v => {
        if (loader.alwaysProcess || matchFile(loaderContext.id, loader.test)) {
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

var index = ((options = {}) => {
  const filter = rollupPluginutils.createFilter(options.include, options.exclude);
  const postcssPlugins = Array.isArray(options.plugins) ? options.plugins.filter(Boolean) : options.plugins;
  const sourceMap = options.sourceMap;
  const postcssLoaderOptions = {
    /** Inject CSS as `<style>` to `<head>` */
    inject: inferOption(options.inject, {}),

    /** Define the api's name of manually inject css */
    manualInjectName: options.manualInjectName,

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
      plugins: postcssPlugins,
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

    transform(code, id) {
      var _this = this;

      return _asyncToGenerator(function* () {
        if (!filter(id) || !loaders.isSupported(id)) {
          return null;
        }

        if (typeof options.onImport === 'function') {
          options.onImport(id);
        }

        const loaderContext = {
          id,
          sourceMap,
          dependencies: new Set(),
          warn: _this.warn.bind(_this),
          plugin: _this
        };
        const res = yield loaders.process({
          code,
          map: undefined
        }, loaderContext);
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = loaderContext.dependencies[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            const dep = _step.value;

            _this.addWatchFile(dep);
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

        if (postcssLoaderOptions.extract) {
          extracted.set(id, res.extracted);
          return {
            code: res.code,
            map: {
              mappings: ''
            }
          };
        }

        return {
          code: res.code,
          map: res.map || {
            mappings: ''
          }
        };
      })();
    },

    generateBundle(opts, bundle) {
      return _asyncToGenerator(function* () {
        if (extracted.size === 0) return; // TODO: support `[hash]`

        const dir = opts.dir || path.dirname(opts.file);
        const file = opts.file || path.join(opts.dir, Object.keys(bundle).find(fileName => bundle[fileName].isEntry));

        const getExtracted = () => {
          const fileName = typeof postcssLoaderOptions.extract === 'string' ? normalizePath(path.relative(dir, postcssLoaderOptions.extract)) : `${path.basename(file, path.extname(file))}.css`;
          const concat = new Concat(true, fileName, '\n');
          const entries = Array.from(extracted.values());
          const modules = bundle[normalizePath(path.relative(dir, file))].modules;

          if (modules) {
            const fileList = Object.keys(modules);
            entries.sort((a, b) => fileList.indexOf(a.id) - fileList.indexOf(b.id));
          }

          for (var _i = 0, _entries = entries; _i < _entries.length; _i++) {
            const res = _entries[_i];
            const relative = normalizePath(path.relative(dir, res.id));
            const map = res.map || null;

            if (map) {
              map.file = fileName;
            }

            concat.add(relative, res.code, map);
          }

          let code = concat.content;

          if (sourceMap === 'inline') {
            code += `\n/*# sourceMappingURL=data:application/json;base64,${Buffer.from(concat.sourceMap, 'utf8').toString('base64')}*/`;
          } else if (sourceMap === true) {
            code += `\n/*# sourceMappingURL=${fileName}.map */`;
          }

          return {
            code,
            map: sourceMap === true && concat.sourceMap,
            codeFileName: fileName,
            mapFileName: fileName + '.map'
          };
        };

        if (options.onExtract) {
          const shouldExtract = yield options.onExtract(getExtracted);

          if (shouldExtract === false) {
            return;
          }
        }

        let _getExtracted = getExtracted(),
            code = _getExtracted.code,
            codeFileName = _getExtracted.codeFileName,
            map = _getExtracted.map,
            mapFileName = _getExtracted.mapFileName; // Perform cssnano on the extracted file


        if (postcssLoaderOptions.minimize) {
          const cssOpts = postcssLoaderOptions.minimize;
          cssOpts.from = codeFileName;

          if (sourceMap === 'inline') {
            cssOpts.map = {
              inline: true
            };
          } else if (sourceMap === true && map) {
            cssOpts.map = {
              prev: map
            };
            cssOpts.to = codeFileName;
          }

          const result = yield require('cssnano').process(code, cssOpts);
          code = result.css;

          if (sourceMap === true && result.map && result.map.toString) {
            map = result.map.toString();
          }
        }

        const codeFile = {
          fileName: codeFileName,
          isAsset: true,
          source: code
        };
        bundle[codeFile.fileName] = codeFile;

        if (map) {
          const mapFile = {
            fileName: mapFileName,
            isAsset: true,
            source: map
          };
          bundle[mapFile.fileName] = mapFile;
        }
      })();
    }

  };
});

module.exports = index;
