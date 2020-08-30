import './foo.css'
import bar from './bar.module.css'
import './nested'
import { component } from './component';

(async () => {
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const dynamicModule = await import('./dynamic')
  console.log(bar, component, dynamicModule)
})()
