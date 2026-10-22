import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export default function NotFoundPage() {
  return <div className="container not-found"><span className="eyebrow">POGREŠNO SKRETANJE / 404</span><span className="not-found-number" aria-hidden="true">404</span><h1>Ovaj put ne vodi nikuda.</h1><p>Stranica koju tražiš ne postoji. Vratimo se na poznat put.</p><Link className="button button-primary" to="/">Nazad na početnu<Icon name="arrow-right" size={18} /></Link></div>;
}
