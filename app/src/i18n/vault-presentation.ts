import type { TFunction } from 'i18next'
import type { VaultPresentation } from '../types/inkforge'

interface PresentableVaultItem extends VaultPresentation {
  name: string
}

export function getVaultPresentationLabel(
  item: PresentableVaultItem,
  t: TFunction,
): string {
  if (!item.presentationKey) {
    return item.name
  }

  return t(item.presentationKey, {
    ...item.presentationValues,
    defaultValue: item.name,
  })
}
