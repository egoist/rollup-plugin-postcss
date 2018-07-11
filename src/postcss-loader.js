import path from 'path'
import importCwd from 'import-cwd'
import postcss from 'postcss'
import findPostcssConfig from 'postcss-load-config'
import reserved from 'reserved-words'
import scopedPlugin from '@vue/component-compiler-utils/dist/stylePlugins/scoped'
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

  return findPostcssConfig(ctx, configPath, { argv: false }).catch(handleError)
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
    const autoModulesPattern = options.autoModulesPattern || /\.module\.[a-z]{2,6}$/
    const autoModules = options.autoModules !== false && autoModulesPattern.test(this.id)
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
          getJSON(filepath, json) {
            modulesExported[filepath] = json
          }
        })
      )
    }

    if (options.minimize) {
      plugins.push(require('cssnano')(options.minimize))
    }

    if (this.scoped) {
      plugins.unshift(scopedPlugin(this.scoped))
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

    const res = await postcss(plugins).process(code, postcssOpts)
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
          console.warn(
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
      };`
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
