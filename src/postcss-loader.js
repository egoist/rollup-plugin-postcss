import path from 'path'
import importCwd from 'import-cwd'
import postcss from 'postcss'
import findPostcssConfig from 'postcss-load-config'
import reserved from 'reserved-words'
import humanlizePath from './utils/humanlize-path'
import normalizePath from './utils/normalize-path'

const styleInjectPath = require
  .resolve('style-inject/dist/style-inject.es')
  .replace(/[\\/]+/g, '/')

function loadConfig(id, { ctx: configOptions, path: configPath }) {
  const handleError = err => {
    if (err.message.indexOf('No PostCSS Config found') === -1) {
      throw err
    }
    // Return empty options for PostCSS
    return {}
  }

  configPath = configPath ? path.resolve(configPath) : path.dirname(id)
  const ctx = {
    file: {
      extname: path.extname(id),
      dirname: path.dirname(id),
      basename: path.basename(id)
    },
    options: configOptions || {}
  }

  return findPostcssConfig(ctx, configPath).catch(handleError)
}

function escapeClassNameDashes(str) {
  return str.replace(/-+/g, match => {
    return `$${match.replace(/-/g, '_')}$`
  })
}

function ensureClassName(name) {
  name = escapeClassNameDashes(name)
  if (reserved.check(name)) {
    name = `$${name}$`
  }
  return name
}

function ensurePostCSSOption(option) {
  return typeof option === 'string' ? importCwd(option) : option
}

function isModuleFile(file) {
  return /\.module\.[a-z]{2,6}$/.test(file)
}

export default {
  name: 'postcss',
  alwaysProcess: true,
  // `test` option is dynamically set in ./loaders
  async process({ code, map }) {
    const config = this.options.config ?
      await loadConfig(this.id, this.options.config) :
      {}

    const options = this.options
    const plugins = [
      ...(options.postcss.plugins || []),
      ...(config.plugins || [])
    ]
    const shouldExtract = options.extract
    const shouldInject = options.inject

    const modulesExported = {}
    const autoModules = options.autoModules !== false && isModuleFile(this.id)
    const supportModules = options.modules || autoModules
    if (supportModules) {
      plugins.push(
        require('postcss-modules')({
          // In tests
          // Skip hash in names since css content on windows and linux would differ because of `new line` (\r?\n)
          generateScopedName: process.env.ROLLUP_POSTCSS_TEST ?
            '[name]_[local]' :
            '[name]_[local]__[hash:base64:5]',
          ...options.modules,
          getJSON(filepath, json, outpath) {
            modulesExported[filepath] = json
            if (
              typeof options.modules === 'object' &&
              typeof options.modules.getJSON === 'function'
            ) {
              return options.modules.getJSON(filepath, json, outpath)
            }
          }
        })
      )
    }

    // If shouldExtract, minimize is done after all CSS are extracted to a file
    if (!shouldExtract && options.minimize) {
      plugins.push(require('cssnano')(options.minimize))
    }

    const postcssOpts = {
      ...this.options.postcss,
      ...config.options,
      // Followings are never modified by user config config
      from: this.id,
      to: this.id,
      map: this.sourceMap ?
        shouldExtract ?
          { inline: false, annotation: false } :
          { inline: true, annotation: false } :
        false
    }
    delete postcssOpts.plugins

    postcssOpts.parser = ensurePostCSSOption(postcssOpts.parser)
    postcssOpts.syntax = ensurePostCSSOption(postcssOpts.syntax)
    postcssOpts.stringifier = ensurePostCSSOption(postcssOpts.stringifier)

    if (map && postcssOpts.map) {
      postcssOpts.map.prev = typeof map === 'string' ? JSON.parse(map) : map
    }

    if (plugins.length === 0) {
      // Prevent from postcss warning:
      // You did not set any plugins, parser, or stringifier. Right now, PostCSS does nothing. Pick plugins for your case on https://www.postcss.parts/ and use them in postcss.config.js
      const noopPlugin = postcss.plugin('postcss-noop-plugin', () => () => {
        /* noop */
      })
      plugins.push(noopPlugin())
    }

    const res = await postcss(plugins).process(code, postcssOpts)

    for (const msg of res.messages) {
      if (msg.type === 'dependency') {
        this.dependencies.add(msg.file)
      }
    }

    for (const warning of res.warnings()) {
      this.warn(warning)
    }

    const outputMap = res.map && JSON.parse(res.map.toString())
    if (outputMap && outputMap.sources) {
      outputMap.sources = outputMap.sources.map(v => normalizePath(v))
    }

    let output = ''
    let extracted

    if (options.namedExports) {
      const json = modulesExported[this.id]
      const getClassName =
        typeof options.namedExports === 'function' ?
          options.namedExports :
          ensureClassName
      // eslint-disable-next-line guard-for-in
      for (const name in json) {
        const newName = getClassName(name)
        // Log transformed class names
        // But skip this when namedExports is a function
        // Since a user like you can manually log that if you want
        if (name !== newName && typeof options.namedExports !== 'function') {
          this.warn(
            `Exported "${name}" as "${newName}" in ${humanlizePath(this.id)}`
          )
        }
        if (!json[newName]) {
          json[newName] = json[name]
        }
        output += `export var ${newName} = ${JSON.stringify(json[name])};\n`
      }
    }

    if (shouldExtract) {
      output += `export default ${JSON.stringify(modulesExported[this.id])};`
      extracted = {
        id: this.id,
        code: res.css,
        map: outputMap
      }
    } else {
      output += `var css = ${JSON.stringify(res.css)};\nexport default ${
        supportModules ? JSON.stringify(modulesExported[this.id]) : 'css'
      };\nexport const stylesheet=${JSON.stringify(res.css)};`
    }
    if (!shouldExtract && shouldInject) {
      output += `\nimport styleInject from '${styleInjectPath}';\nstyleInject(css${
        Object.keys(options.inject).length > 0 ?
          `,${JSON.stringify(options.inject)}` :
          ''
      });`
    }

    return {
      code: output,
      map: outputMap,
      extracted
    }
  }
}
