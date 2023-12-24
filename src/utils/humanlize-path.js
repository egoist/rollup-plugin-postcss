import path from 'node:path'
import normalizePath from './normalize-path.js'

const humanlizePath = filepath => normalizePath(path.relative(process.cwd(),
  filepath))

export default humanlizePath
