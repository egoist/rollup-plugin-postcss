import fs from 'fs'
import EventEmitter from 'eventemitter3'
import chokidar from 'chokidar'
import { clone, difference } from './helpers'

function checkIfFileExists(fileName) {
  return fs.existsSync(fileName)
}

export default class Watcher extends EventEmitter {
  constructor() {
    super()

    this._ = {
      files: [],
      watchers: {}
    }
  }

  watch(filesToWatch) {
    if (Array.isArray(filesToWatch)) {
      filesToWatch = clone(filesToWatch).filter(checkIfFileExists)

      const toUnwatch = difference(this._.files, filesToWatch)
      const toWatch = difference(filesToWatch, this._.files)

      if (toUnwatch.length > 0) {
        console.log('Removing watch from:', toUnwatch)
      }
      if (toWatch.length > 0) {
        console.log('Adding watch for:', toWatch)
      }

      toUnwatch.forEach(fileName => {
        this._.watchers[fileName].close()
        delete this._.watchers[fileName]
      })

      toWatch.forEach(fileName => {
        this._.watchers[fileName] = chokidar
          .watch(fileName)
          .on('change', fileName => this.emit('change', fileName))
      })

      this._.files = filesToWatch
    }
  }
}
