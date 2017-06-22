import EventEmitter from 'eventemitter3'
import fs from 'fs'
import chokidar from 'chokidar'

import {
  clone,
  difference
} from './helpers'

function checkIfFileExists(fileName){
  return fs.existsSync(fileName)
}

export default class Watcher extends EventEmitter{
  constructor(){
    super()

    this._ = {
      files: [],
      watchers: {}
    }
  }

  watch(filesToWatch){
    console.log('Adding files to watch: ', filesToWatch)
    if(Array.isArray(filesToWatch)){
      filesToWatch = filesToWatch.filter(checkIfFileExists)

      const toUnwatch = difference(this._.files, filesToWatch)
      const toWatch = difference(filesToWatch, this._.files)

      toUnwatch.forEach(fileName => {
        this._.watchers[fileName].close()
        delete this._.watchers[fileName]
      })

      toWatch.forEach(fileName => {
        this._.watchers[fileName] = chokidar.watch(fileName).on('change', fileName => this.emit('change', fileName))
      })

      this._.files = filesToWatch
    }
  }
}
