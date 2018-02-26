import path from 'path'

const normalizePath = filepath => path.relative(process.cwd(),
filepath)

export default normalizePath
