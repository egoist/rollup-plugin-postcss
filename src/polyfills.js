const runPolyfills = () => {
  // based on: https://github.com/tc39/proposal-object-values-entries/blob/master/polyfill.js
  if(!Object.entries){
    Object.entries = function(O){
      return Object.keys(O).reduce(function(e, k){
        return e.concat(typeof k === 'string' && O.propertyIsEnumerable(k) ? [[k, O[k]]] : [])
      }, [])
    }
  }
}

export default runPolyfills
