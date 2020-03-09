import importCwd from 'import-cwd'
import path from 'path'
import postcss, { AcceptedPlugin, Result } from 'postcss'
import findPostcssConfig from 'postcss-load-config'
import { SourceDescription } from 'rollup'
import { identifier } from 'safe-identifier'

import { Loader, LoaderContext } from '../type'
import { extracted, humanlizePath, normalizePath } from '../util'

const styleInjectPath = require
  .resolve('style-inject/dist/style-inject.es')
  .replace(/[\\/]+/g, '/')

// @ts-ignore
function loadConfig (id, { ctx: configOptions, path: configPath }) {
  const handleError = (err: Error) => {
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

  // fixme: remove as any
  return findPostcssConfig(ctx as any, configPath).catch(handleError)
}

function escapeClassNameDashes (str: string): string {
  return str.replace(/-+/g, match => {
    return `$${match.replace(/-/g, '_')}$`
  })
}

function ensureClassName (name: string) {
  name = escapeClassNameDashes(name)
  return identifier(name, false)
}

function ensurePostCSSOption (option: any) {
  return typeof option === 'string' ? importCwd(option) : option
}

function isModuleFile (file: string) {
  return /\.module\.[a-z]{2,6}$/.test(file)
}

export class PostcssLoader implements Loader {
  always = true
  name = 'postcss'

  async process ({ code, map }: SourceDescription, context: LoaderContext): Promise<SourceDescription> {
    const config: { [key: string]: any } = context.options.config
      ? await loadConfig(context.id, context.options.config)
      : {}

    const options = context.options
    const plugins: AcceptedPlugin[] = [
      ...(options.postcss.plugins || []),
      ...(config.plugins || [])
    ]
    const shouldExtract = options.extract
    const shouldInject = options.inject

    const modulesExported = {} as { [key: string]: any }
    const autoModules = options.autoModules !== false && isModuleFile(context.id)
    const supportModules = options.modules || autoModules
    if (supportModules) {
      plugins.push(
        require('postcss-modules')({
          // In tests
          // Skip hash in names since css content on windows and linux would differ because of `new line` (\r?\n)
          generateScopedName: process.env.ROLLUP_POSTCSS_TEST
            ? '[name]_[local]'
            : '[name]_[local]__[hash:base64:5]',
          ...options.modules,
          getJSON (filepath: string, json: string, outpath: string) {
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
      ...context.options.postcss,
      ...config.options,
      // Allow overriding `to` for some plugins that are relying on this value
      to: options.to || context.id,
      // Followings are never modified by user config config
      from: context.id,
      map: context.sourceMap
        ? shouldExtract
          ? { inline: false, annotation: false }
          : { inline: true, annotation: false }
        : false
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

    let res: Result
    try {
      res = await postcss(plugins)
        .process(code, postcssOpts)
    } catch (e) {
      context.rollup.error(e)
    }

    for (const msg of res.messages) {
      if (msg.type === 'dependency') {
        context.dependencies.add(msg.file)
      }
    }

    for (const warning of res.warnings()) {
      context.rollup.warn(warning.toString())
    }

    const outputMap = res.map && JSON.parse(res.map.toString())
    if (outputMap && outputMap.sources) {
      outputMap.sources = outputMap.sources.map((v: string) => normalizePath(v))
    }

    let output = ''

    if (options.namedExports) {
      const json = modulesExported[context.id]
      const getClassName =
        typeof options.namedExports === 'function'
          ? options.namedExports
          : ensureClassName
      // eslint-disable-next-line guard-for-in
      for (const name in json) {
        const newName = getClassName(name)
        // Log transformed class names
        // But skip this when namedExports is a function
        // Since a user like you can manually log that if you want
        if (name !== newName && typeof options.namedExports !== 'function') {
          context.rollup.warn(
            `Exported "${name}" as "${newName}" in ${humanlizePath(context.id)}`
          )
        }
        if (!json[newName]) {
          json[newName] = json[name]
        }
        output += `export var ${newName} = ${JSON.stringify(json[name])};\n`
      }
    }

    const cssVariableName = identifier('css', true)
    if (shouldExtract) {
      output += `export default ${JSON.stringify(modulesExported[context.id])};`
      extracted.set(context.id, {
        id: context.id,
        code: res.css,
        map: outputMap
      })
    } else {
      const module = supportModules
        ? JSON.stringify(modulesExported[context.id])
        : cssVariableName
      output +=
        `var ${cssVariableName} = ${JSON.stringify(res.css)};\n` +
        `export default ${module};\n` +
        `export const stylesheet=${JSON.stringify(res.css)};`
    }
    if (!shouldExtract && shouldInject) {
      if (typeof options.inject === 'function') {
        output += options.inject(cssVariableName, context.id)
      } else {
        output += '\n' +
          `import styleInject from '${styleInjectPath}';\n` +
          `styleInject(${cssVariableName}${
            Object.keys(options.inject).length > 0
              ? `,${JSON.stringify(options.inject)}`
              : ''
          });`
      }
    }

    return {
      code: output,
      map: outputMap
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test (fileName: string): boolean {
    throw Error('must be reset')
  }
}
