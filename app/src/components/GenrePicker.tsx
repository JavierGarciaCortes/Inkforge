import { useTranslation } from 'react-i18next'
import type { GenreProfileSummary } from '../types/inkforge'

interface GenrePickerProps {
  profiles: GenreProfileSummary[]
  selected: string[]
  onChange: (genres: string[]) => void
  disabled?: boolean
  label: string
  catalogReady?: boolean
}

export function GenrePicker({ profiles, selected, onChange, disabled = false, label, catalogReady = true }: GenrePickerProps) {
  const { t } = useTranslation()
  const available = new Set(profiles.map((profile) => profile.name))
  const names = [...profiles.map((profile) => profile.name), ...selected.filter((name) => !available.has(name))]

  return (
    <fieldset className="genre-picker" disabled={disabled}>
      <legend>{label}</legend>
      {names.length === 0 && <p>{t('genres.noneAvailable')}</p>}
      <div className="genre-picker-list">
        {names.map((name) => (
          <label key={name} className="genre-picker-option">
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={(event) => onChange(event.target.checked
                ? [...selected, name]
                : selected.filter((selectedName) => selectedName !== name))}
            />
            <span>{name}</span>
            {catalogReady && !available.has(name) && <small>{t('genres.unavailable')}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
