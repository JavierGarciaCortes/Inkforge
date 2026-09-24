import type es from './es'

type StringResources<T> = {
  readonly [Key in keyof T]: T[Key] extends string
    ? string
    : StringResources<T[Key]>
}

export type TranslationResources = StringResources<typeof es>
