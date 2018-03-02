import path from 'path'

const humanlizePath = filepath => path.relative(process.cwd(),
filepath)

export default humanlizePath
