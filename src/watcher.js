import EventEmitter from 'eventemitter3'

import { clone } from './helpers'

export default class Watcher extends EventEmitter{
  constructor(){
    super()

    this._ = {
      source: '',
      filesToWatch: []
    }
  }

  set source(fileName){
    this._.source = fileName
  }

  watch(filesToWatch){
    if(Array.isArray(filesToWatch)){
      let files = clone(filesToWatch).filter(file => file !== this._.source)

      // TODO: check is files exist
      // TODO: remove watching of previous values in this._.filesToWatch
      // TODO: add watch for new files

      this._.filesToWatch = files
    }
  }
}
