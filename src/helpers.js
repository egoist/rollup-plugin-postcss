function isFunction(f) {
  return typeof f === 'function'
}

function isString(s) {
  return typeof f === 'string'
}

function dummyPreprocessor(code) {
  return Promise.resolve({code})
}

function dashesCamelCase(str) {
  return str.replace(/-(\w)/g, (match, firstLetter) => {
    return firstLetter.toUpperCase()
  })
}

export {
  isFunction,
  isString,
  dummyPreprocessor,
  dashesCamelCase
}
