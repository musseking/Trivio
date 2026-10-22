import { useContext } from 'react'
import { Icon } from '../components/Icon'
import { ThemeContext } from './ThemeProvider'

export function ThemeToggle() {
  const theme = useContext(ThemeContext)
  if (!theme) return null
  const nextTheme = theme.dark ? 'light' : 'dark'
  return <button type="button" className="theme-toggle" onClick={() => theme.setPreference(nextTheme)}
    aria-label={theme.dark ? 'Uključi svetlu temu' : 'Uključi tamnu temu'}
    title={theme.dark ? 'Svetla tema' : 'Tamna tema'}>
    <Icon name={theme.dark ? 'sun' : 'moon'} size={19} />
    <span className="theme-toggle-label">{theme.dark ? 'Svetla' : 'Tamna'}</span>
  </button>
}
