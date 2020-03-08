import path from 'path'
import normalizePath from './normalize-path'

const humanlizePath = filepath => normalizePath(path.relative(process.cwd(),
  filepath))

export default humanlizePath
