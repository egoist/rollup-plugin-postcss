import './declare'

import { PluginContext, SourceDescription } from 'rollup'

export interface LoaderContext {
  id: string
  sourceMap: boolean | 'inline' | Map<any, any>
  dependencies: Set<string>
  rollup: PluginContext
  options: any
}

export interface Loader {
  name: string
  always: boolean

  process (source: SourceDescription, context: LoaderContext): SourceDescription | Promise<SourceDescription>

  test (str: string): boolean
}
