import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Icon } from './Icon';
import { ThemeToggle } from '../theme/ThemeToggle';
import { ProfileDialog } from './ProfileDialog';
import { Avatar } from './Avatar';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="Trivio — početna">
    <svg viewBox="0 0 40 40" width="35" height="35" aria-hidden="true"><rect width="40" height="40" rx="12" fill="currentColor" /><path d="M9 11h24l-3.5 6H23l-5.5 14H10l5.5-14H7z" fill="var(--brand-mark)" /></svg>
    <span>Trivio<span className="brand-dot">.</span></span>
  </Link>;
}

export function Layout() {
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { if (!isAuthenticated) setProfileOpen(false); }, [isAuthenticated]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  const signOut = () => { logout(); setMenuOpen(false); navigate('/', { replace: true }); };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Pređi na sadržaj</a>
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <button ref={menuToggleRef} className="icon-button mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Zatvori meni' : 'Otvori meni'}
          aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
        </button>
        <div id="primary-navigation" className={`header-navigation ${menuOpen ? 'is-open' : ''}`}>
          <nav aria-label="Glavna navigacija" className="main-nav">
            <NavLink to="/" end>Početna</NavLink>
            <NavLink to="/automobili">Automobili</NavLink>
            <NavLink to="/porudzbine">Moje porudžbine</NavLink>
            {user?.role === 'OWNER' && <NavLink to="/owner">Control panel</NavLink>}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {isAuthenticated ? <>
              <div className="header-user">{user && <Avatar user={user} onEmptyClick={() => setProfileOpen(true)} />}<button type="button" className="header-user-name" title="Uredi profil" aria-label="Uredi profil" aria-haspopup="dialog" onClick={() => setProfileOpen(true)}>Zdravo, {user?.firstName}</button></div>
              <button type="button" className="button button-ghost header-logout" onClick={signOut}><Icon name="logout" size={17} />Odjavi se</button>
            </> : <>
              <NavLink className="login-link" to="/prijava"><Icon name="user" size={18} />Prijavi se</NavLink>
              <Link className="button button-primary button-small" to="/registracija">Kreiraj nalog<Icon name="arrow-up-right" size={17} /></Link>
            </>}
          </div>
        </div>
      </div>
    </header>
    {profileOpen && user && <ProfileDialog key={user.id} user={user} onClose={() => setProfileOpen(false)} />}
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer">
      <div className="container footer-top">
        <div><Brand light /><p>Za sve puteve koji su pred tobom.</p></div>
        <nav aria-label="Navigacija u podnožju"><Link to="/automobili">Istraži automobile<Icon name="arrow-up-right" size={15} /></Link><Link to="/porudzbine">Moje porudžbine<Icon name="arrow-up-right" size={15} /></Link></nav>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} Trivio</span><span>Studentski projekat · Prodaja automobila</span><span className="footer-tagline">Tvoje sledeće poglavlje.</span></div>
    </footer>
  </div>;
}
