import importCwd from 'import-cwd'
import { relative } from 'path'

export const normalizePath = (path: string) => path && path.replace(/\\+/g, '/')

export const extracted = new Map()

export function loadModule (moduleID: string) {
  try {
    return require(moduleID)
  } catch (e) {
    // ignore error
  }

  // trying to load it relative to CWD
  return importCwd.silent(moduleID)
}

export const humanlizePath = (filepath: string) => normalizePath(relative(process.cwd(), filepath))

export function series<T> (tasks: any[], initial: T): Promise<T> {
  if (!Array.isArray(tasks)) {
    return Promise.reject(new TypeError('promise.series only accepts an array of functions'))
  }
  return tasks.reduce<Promise<T>>((current: Promise<T>, next) => {
    return current.then(next)
  }, Promise.resolve(initial))
}
