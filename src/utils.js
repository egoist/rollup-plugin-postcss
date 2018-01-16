import path from 'path'

export const localRequire = name => require(path.resolve('node_modules', name))

export const normalizePath = filepath => path.relative(process.cwd(), filepath)
