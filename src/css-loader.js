export default {
  name: 'css',
  test: /\.css$/,
  process({ code, map }) {
    const shouldExtract = this.options.extract
    const shouldInject = this.options.inject
    let output = ''
    let extracted
    if (shouldExtract) {
      output += `export default {};`
      extracted = {
        code,
        id: this.id,
        map
      }
    } else {
      output += `var css = ${JSON.stringify(code)};\nexport default css;`
    }
    if (!shouldExtract && shouldInject) {
      output += '\n__$$styleInject(css);'
    }
    return {
      code: output,
      map,
      extracted
    }
  }
}
