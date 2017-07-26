import postcss from 'rollup-plugin-postcss'
import less from 'postcss-less-engine'

const isWatching = process.env.ROLLUP_WATCH
let watcher

export default {
  entry: 'src/index.less',
  dest: 'dist/css/dummy',
  plugins: [
    postcss({
      extensions: ['.less'],
      extract: 'dist/style.css',
      getInstance: instance => {
        watcher = instance.watcher
      },
      plugins: [
        less({
          onImport: sources => {
            if(isWatching){
              watcher.watch(sources)
            }
          }
        })
      ],
      parser: less.parser
    })
  ]
}