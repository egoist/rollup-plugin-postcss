declare module 'safe-identifier' {
  export function property (obj: string, key: string): string

  export function identifier (key: string, unique: boolean): string
}
