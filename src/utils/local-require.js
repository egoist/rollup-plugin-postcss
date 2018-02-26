import path from 'path'

const localRequire = name => require(path.resolve('node_modules', name))

export default localRequire
