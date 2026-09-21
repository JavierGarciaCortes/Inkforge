/// <reference types="vite/client" />

import type { InkforgeBridge } from './types/inkforge'

declare global {
  interface Window {
    inkforge?: InkforgeBridge
  }
}

export {}
