import './foo.css'
import bar from './bar.module.css'
import './nested'
import dynamicComponent, { component } from './component';

(async () => {
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const dynamicModule = await import('./dynamic')
  dynamicComponent()
  console.log(bar, component, dynamicModule)
})()
