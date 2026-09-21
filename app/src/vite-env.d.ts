/// <reference types="vite/client" />

interface InkforgeAppInfo {
  name: string
  version: string
}

interface InkforgeBridge {
  getAppInfo: () => Promise<InkforgeAppInfo>
}

interface Window {
  inkforge?: InkforgeBridge
}
