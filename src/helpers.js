function isFunction(f) {
  return typeof f === 'function'
}

function isString(s) {
  return typeof s === 'string'
}

function dummyPreprocessor(code) {
  return Promise.resolve({ code })
}

function clone(data) {
  return typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
}

function difference(a, b) {
  return a.filter(ax => !b.includes(ax))
}

export {
 isFunction,
 isString,
 dummyPreprocessor,
 clone,
 difference
}
