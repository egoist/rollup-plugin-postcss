import postcss from 'postcss'

export default {
  name: 'postcss',
  test: /\.css$/,
  async process({ code, map }) {
    if (!this.sourceMap && map) {
      console.warn(
        `\n\n ⚠️  rollup-plugin-postcss\n\nPrevious source map found, but options.sourceMap isn't set.\nIn this case the loader will discard the source map entirely for performance reasons.\n\n`
      )
    }

    const options = this.options
    const plugins = options.plugins || []
    const shouldExtract = options.extract
    const shouldInject = options.inject

    const modulesExported = {}
    if (options.modules) {
      plugins.unshift(
        require('postcss-modules')({
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

    const postcssOpts = {
      from: this.id,
      to: this.id,
      map: this.sourceMap ?
        shouldExtract ?
          { inline: false, annotation: false } :
          { inline: true, annotation: false } :
        false
    }

    if (map && postcssOpts.map) {
      postcssOpts.map.prev = typeof map === 'string' ? JSON.parse(map) : map
    }

    const res = await postcss(plugins).process(code, postcssOpts)

    let output = ''
    let extracted
    if (shouldExtract) {
      output += `export default ${JSON.stringify(modulesExported[this.id])};`
      extracted = {
        id: this.id,
        code: res.css,
        map: res.map
      }
    } else {
      output += `var css = ${JSON.stringify(res.css)};\nexport default ${
        options.modules ? JSON.stringify(modulesExported[this.id]) : 'css'
      };`
    }
    if (!shouldExtract && shouldInject) {
      output += `\n__$$styleInject(css${
        Object.keys(options.inject).length > 0 ? `,${JSON.stringify(options.inject)}` : ''
      });`
    }

    return {
      code: output,
      map: res.map,
      extracted
    }
  }
}
