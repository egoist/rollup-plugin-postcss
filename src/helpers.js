function isFunction(f) {
  return typeof f === 'function'
}

function isString(s) {
  return typeof s === 'string'
}

function dummyPreprocessor(code) {
  return Promise.resolve({code})
}

function dashesCamelCase(str) {
  return str.replace(/-(\w)/g, (match, firstLetter) => firstLetter.toUpperCase())
}

function clone(data) {
  return typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
}

export {
  isFunction,
  isString,
  dummyPreprocessor,
  dashesCamelCase,
  clone
}
