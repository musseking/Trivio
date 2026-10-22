import type { OrderStatus, VehicleStatus } from '../api/types';

const labels: Record<OrderStatus | VehicleStatus, string> = {
  AVAILABLE: 'Dostupno', RESERVED: 'Rezervisano', SOLD: 'Prodato',
  PENDING: 'Na čekanju', CONFIRMED: 'Potvrđena', CANCELLED: 'Otkazana',
};

export function StatusBadge({ status }: { status: OrderStatus | VehicleStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>
    <span aria-hidden="true" />{labels[status] ?? status}
  </span>;
}
