import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const title = pathname === '/' ? 'Tvoj sledeći automobil'
      : pathname === '/automobili' ? 'Automobili'
      : pathname.startsWith('/automobili/') ? 'Detalji automobila'
      : pathname === '/prijava' ? 'Prijava'
      : pathname === '/registracija' ? 'Registracija'
      : pathname === '/postavljanje' ? 'Prvo podešavanje vlasnika'
      : pathname === '/porudzbine' ? 'Moje porudžbine'
      : pathname === '/owner/automobili/novi' ? 'Dodaj automobil'
      : pathname.startsWith('/owner/') ? 'OWNER Control panel' : 'Stranica nije pronađena';
    document.title = `${title} | Trivio`;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
