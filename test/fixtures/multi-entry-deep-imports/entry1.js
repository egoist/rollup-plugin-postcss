import styles from './entry1.css'
import extraStyles from './entry1-extra.css'
import './empty-import.css'
import { foo, bar } from './layered'

console.log({ foo, bar })
console.log(styles, extraStyles)
