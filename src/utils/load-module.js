import importCwd from 'import-cwd'

export function loadModule(moduleId) {
  // Trying to load module normally (relative to plugin directory)
  const path = require.resolve(moduleId)
  if (path) {
    return require(path)
  }

  // Then, trying to load it relative to CWD
  return importCwd.silent(moduleId)
}
