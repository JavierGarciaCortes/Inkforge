export interface InkforgeAppInfo {
  name: string
  version: string
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface VaultDirectoryNode {
  type: 'directory'
  name: string
  path: string
  children: VaultTreeNode[]
}

export interface VaultDocumentNode {
  type: 'document'
  name: string
  path: string
}

export type VaultTreeNode = VaultDirectoryNode | VaultDocumentNode

export interface VaultDocument {
  name: string
  path: string
  content: string
}

export interface InkforgeBridge {
  getAppInfo: () => Promise<InkforgeAppInfo>
  vault: {
    list: () => Promise<VaultTreeNode[]>
    read: (relativePath: string) => Promise<VaultDocument>
  }
}
