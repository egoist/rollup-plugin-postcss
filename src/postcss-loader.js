import path from 'path'
import importCwd from 'import-cwd'
import postcss from 'postcss'
import findPostcssConfig from 'postcss-load-config'
import { identifier } from 'safe-identifier'
import humanlizePath from './utils/humanlize-path'
import normalizePath from './utils/normalize-path'

const CSS_STYLESHEET_VARIABLE_NAME = 'stylesheet'

const styleInjectPath = require
  .resolve('style-inject/dist/style-inject.es')
  .replace(/[\\/]+/g, '/')

function loadConfig(id, { ctx: configOptions, path: configPath }) {
  const handleError = err => {
    if (!err.message.includes('No PostCSS Config found')) {
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

function escapeClassNameDashes(string) {
  return string.replace(/-+/g, match => {
    return `$${match.replace(/-/g, '_')}$`
  })
}

function ensureClassName(name) {
  name = escapeClassNameDashes(name)
  return identifier(name, false)
}

function ensurePostCSSOption(option) {
  return typeof option === 'string' ? importCwd(option) : option
}

function isModuleFile(file) {
  return /\.module\.[a-z]{2,6}$/.test(file)
}

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */
export default {
  name: 'postcss',
  alwaysProcess: true,
  // `test` option is dynamically set in ./loaders
  // eslint-disable-next-line complexity
  async process({ code, map }) {
    const config = this.options.config ?
      await loadConfig(this.id, this.options.config) :
      {}

    const { options } = this
    const plugins = [
      ...(options.postcss.plugins || []),
      ...(config.plugins || [])
    ]
    const shouldExtract = options.extract
    const shouldInject = options.inject

    const modulesExported = {}
    const autoModules =
      options.autoModules !== false && options.onlyModules !== true
    const isAutoModule = autoModules && isModuleFile(this.id)
    const supportModules = autoModules ? isAutoModule : options.modules
    if (supportModules) {
      plugins.unshift(
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

    const postcssOptions = {
      ...this.options.postcss,
      ...config.options,
      // Allow overriding `to` for some plugins that are relying on this value
      to: options.to || this.id,
      // Followings are never modified by user config config
      from: this.id,
      map: this.sourceMap ?
        (shouldExtract ?
          { inline: false, annotation: false } :
          { inline: true, annotation: false }) :
        false
    }
    delete postcssOptions.plugins

    postcssOptions.parser = ensurePostCSSOption(postcssOptions.parser)
    postcssOptions.syntax = ensurePostCSSOption(postcssOptions.syntax)
    postcssOptions.stringifier = ensurePostCSSOption(postcssOptions.stringifier)

    if (map && postcssOptions.map) {
      postcssOptions.map.prev = typeof map === 'string' ? JSON.parse(map) : map
    }

    if (plugins.length === 0) {
      // Prevent from postcss warning:
      // You did not set any plugins, parser, or stringifier. Right now, PostCSS does nothing. Pick plugins for your case on https://www.postcss.parts/ and use them in postcss.config.js
      const noopPlugin = () => {
        return {
          postcssPlugin: 'postcss-noop-plugin',
          Once() {}
        }
      }

      plugins.push(noopPlugin())
    }

    const result = await postcss(plugins).process(code, postcssOptions)

    for (const message of result.messages) {
      if (message.type === 'dependency') {
        this.dependencies.add(message.file)
      }
    }

    for (const warning of result.warnings()) {
      if (!warning.message) {
        warning.message = warning.text
      }

      this.warn(warning)
    }

    const outputMap = result.map && JSON.parse(result.map.toString())
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
        code: result.css,
        map: outputMap
      }
    } else {
      const module = supportModules ?
        JSON.stringify(modulesExported[this.id]) :
        CSS_STYLESHEET_VARIABLE_NAME
      output += `export default ${module};\n`
    }

    output += `export var ${CSS_STYLESHEET_VARIABLE_NAME} = ${JSON.stringify(
      result.css
    )};\n`

    if (!shouldExtract && shouldInject) {
      output +=
        typeof options.inject === 'function' ?
          options.inject(CSS_STYLESHEET_VARIABLE_NAME, this.id) :
          '\n' +
            `import styleInject from '${styleInjectPath}';\n` +
            `styleInject(${CSS_STYLESHEET_VARIABLE_NAME}${
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
