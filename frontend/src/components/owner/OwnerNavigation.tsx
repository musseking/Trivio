import { NavLink } from 'react-router-dom'
import { Icon } from '../Icon'
import './owner-users.css'

export function OwnerNavigation() {
  return <nav className="owner-navigation" aria-label="Vlasnički panel">
    <NavLink to="/owner/automobili"><Icon name="car" size={18} />Automobili</NavLink>
    <NavLink to="/owner/korisnici"><Icon name="user" size={18} />Korisnici</NavLink>
  </nav>
}
