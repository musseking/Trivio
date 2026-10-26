import { Link, useLocation } from 'react-router-dom';
import type { Vehicle } from '../api/types';
import { formatFuel, formatMileage, formatPrice } from '../lib/format';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';
import { VehicleImage, coverPhoto } from './VehicleImage';

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const location = useLocation();
  const catalogReturnTo = location.pathname === '/automobili' ? location.pathname + location.search : '/automobili';
  return <article className="vehicle-card">
    <Link className="vehicle-card-link" to={`/automobili/${vehicle.id}`} state={{ catalogReturnTo }}>
      <div className="vehicle-card-image">
        <VehicleImage photo={coverPhoto(vehicle.photos)} alt={`${vehicle.brand} ${vehicle.model}`} />
        <div className="vehicle-card-status"><StatusBadge status={vehicle.status} /></div>
      </div>
      <div className="vehicle-card-content">
        <p className="vehicle-brand">{vehicle.brand}</p>
        <h3>{vehicle.model}</h3>
        <div className="vehicle-specs">
          <span><Icon name="calendar" size={15} />{vehicle.year}.</span>
          <span><Icon name="gauge" size={15} />{formatMileage(vehicle.mileage)}</span>
          <span><Icon name="fuel" size={15} />{formatFuel(vehicle.fuelType)}</span>
        </div>
        <div className="vehicle-card-bottom">
          <strong>{formatPrice(vehicle.price)}</strong>
          <span className="card-arrow"><Icon name="arrow-up-right" size={20} /><span className="sr-only">Pogledaj detalje za {vehicle.brand} {vehicle.model}</span></span>
        </div>
      </div>
    </Link>
  </article>;
}
