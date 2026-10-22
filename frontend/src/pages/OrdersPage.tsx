import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getErrorMessage } from '../api/client'
import { getMyOrders } from '../api/orders'
import { useAuth } from '../auth/useAuth'
import { AsyncState } from '../components/AsyncState'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { formatDate, formatPrice } from '../lib/format'

export default function OrdersPage() {
  const { accessToken, user } = useAuth()
  const loadOrders = useCallback((signal: AbortSignal) => {
    if (!accessToken) return Promise.reject(new ApiError(401, 'Prijavi se da vidiš svoje porudžbine.'))
    return getMyOrders(accessToken, signal)
  }, [accessToken])
  const { data, isLoading, error, retry } = useAsyncResource(loadOrders)
  const orders = data ? [...data].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id) : []

  return (
    <section className="container orders-page page-space">
      <div className="page-intro">
        <div>
          <p className="eyebrow">TVOJ TRIVIO NALOG</p>
          <h1 className="page-title">Moje porudžbine</h1>
          <p className="page-description">{user?.firstName ? `${user.firstName}, ovde` : 'Ovde'} možeš pratiti svoje porudžbine i njihov trenutni status.</p>
        </div>
        <Link className="button button-secondary" to="/automobili">Istraži automobile<Icon name="arrow-right" size={18} /></Link>
      </div>

      {isLoading ? <AsyncState kind="loading" title="Učitavamo tvoje porudžbine" description="Preuzimamo najnovije podatke o tvojim porudžbinama." />
        : error ? <AsyncState kind="error" title="Porudžbine nisu učitane" description={getErrorMessage(error)} onRetry={retry} />
          : orders.length === 0 ? <AsyncState kind="empty" title="Tvoja sledeća priča još nije počela" description="Još nemaš porudžbina. Pogledaj katalog i pronađi automobil koji ti odgovara."
            action={<Link className="button button-primary" to="/automobili">Pogledaj automobile<Icon name="arrow-right" size={18} /></Link>} />
            : <>
              <div className="orders-summary" aria-label="Pregled porudžbina">
                <div className="orders-summary-item"><Icon name="package" size={22} /><div><strong>{orders.length}</strong><span>Ukupno porudžbina</span></div></div>
                <div className="orders-summary-item"><Icon name="clock" size={22} /><div><strong>{orders.filter((order) => order.status === 'PENDING').length}</strong><span>Na čekanju</span></div></div>
                <div className="orders-summary-item"><Icon name="check" size={22} /><div><strong>{orders.filter((order) => order.status === 'CONFIRMED').length}</strong><span>Potvrđeno</span></div></div>
              </div>
              <div className="orders-list">
                {orders.map((order) => <article key={order.id} className="order-card" aria-labelledby={`order-${order.id}`}>
                  <div className="order-card-header">
                    <div className="order-meta">
                      <h2 id={`order-${order.id}`} className="order-number">Porudžbina #{order.id}</h2>
                      <span className="order-date"><Icon name="calendar" size={15} /><time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time></span>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="order-card-body">
                    <div className="order-detail">
                      <span className="muted">Automobil</span>
                      <Link className="order-vehicle-link" to={`/automobili/${order.vehicleId}`}><Icon name="car" size={20} />Vozilo #{order.vehicleId}<Icon name="arrow-right" size={16} /></Link>
                    </div>
                    <div className="order-detail"><span className="muted">Kupac</span><strong>{order.customerName}</strong></div>
                    <div className="order-detail order-total"><span className="muted">Iznos porudžbine</span><strong>{formatPrice(order.price)}</strong></div>
                  </div>
                </article>)}
              </div>
            </>}

      <p className="session-note"><Icon name="shield" size={16} /> Prikazane su samo porudžbine povezane sa tvojim korisničkim nalogom.</p>
    </section>
  )
}
