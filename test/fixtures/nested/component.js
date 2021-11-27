import component from './component.module.css'

export { component }

export default function test() {
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  return import('./nested-dynamic').then(() => {
    return 'nested-dynamic'
  })
}
