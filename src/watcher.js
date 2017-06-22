import EventEmitter from 'eventemitter3'
import { clone } from './helpers'
import fs from 'fs'
import chokidar from 'chokidar'

function checkIfFileExists(fileName){
  return fs.existsSync(fileName)
}

export default class Watcher extends EventEmitter{
  constructor(){
    super()

    this._ = {
      source: '',
      watcher: null
    }
  }

  set source(fileName){
    this._.source = fileName
  }

  watch(filesToWatch){
    if(Array.isArray(filesToWatch)){
      if(this._.watcher){
        this._.watcher.close()
        this._.watcher = null
      }

      const files = clone(filesToWatch).filter(file => file !== this._.source && checkIfFileExists(file))

      this._.watcher = chokidar.watch(files).on('change', (fileName) => this.emit('change', fileName))
    }
  }
}
