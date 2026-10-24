import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, getErrorMessage, isAbortError } from '../../api/client'
import type { User } from '../../api/types'
import { deleteUser, listUsers, setUserEnabled } from '../../api/user-management'
import { useAuth } from '../../auth/useAuth'
import { AsyncState } from '../../components/AsyncState'
import { Icon } from '../../components/Icon'
import { ConfirmDialog } from '../../components/owner/ConfirmDialog'
import { OwnerNavigation } from '../../components/owner/OwnerNavigation'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { formatDate } from '../../lib/format'
import { Avatar } from '../../components/Avatar'

type Action = 'ban' | 'unban' | 'delete'
const roleLabels = { OWNER: 'Vlasnik', ADMIN: 'Administrator', CUSTOMER: 'Kupac' }
const actionLabels = { ban: 'Banuj nalog', unban: 'Ukloni ban', delete: 'Obriši nalog' }
const pageSize = 10

export default function OwnerUsersPage() {
  const { accessToken, user: owner } = useAuth()
  const loadUsers = useCallback((signal: AbortSignal) => accessToken
    ? listUsers(accessToken, signal)
    : Promise.reject(new ApiError(401, 'Prijavi se da nastaviš.')), [accessToken])
  const { data: users, isLoading, error, retry } = useAsyncResource(loadUsers)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState<{ user: User; action: Action } | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestRef.current?.abort() }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase('sr-Latn')
  const filtered = (users ?? []).filter(user => (!role || user.role === role)
    && (!status || (status === 'active' ? user.enabled : !user.enabled))
    && `${user.firstName} ${user.lastName} ${user.email} #${user.id}`.toLocaleLowerCase('sr-Latn').includes(normalizedQuery))
    .sort((a, b) => b.id - a.id)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = Boolean(query || status || role)

  function openConfirmation(user: User, action: Action) {
    setActionError(null)
    setConfirming({ user, action })
  }

  async function performAction() {
    if (!confirming || !accessToken || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setActionError(null)
    setNotice(null)
    const { user, action } = confirming
    try {
      if (action === 'delete') await deleteUser(accessToken, user.id, controller.signal)
      else await setUserEnabled(accessToken, user.id, action === 'unban', controller.signal)
      if (!mountedRef.current) return
      const name = `${user.firstName} ${user.lastName}`
      setNotice(action === 'delete' ? `Nalog korisnika ${name} je obrisan.`
        : action === 'ban' ? `Nalog korisnika ${name} je banovan.` : `Ban za korisnika ${name} je uklonjen.`)
      setConfirming(null)
      retry()
    } catch (caught) {
      if (mountedRef.current && !isAbortError(caught)) {
        setActionError(caught instanceof ApiError && caught.status === 403
          ? 'Nemaš dozvolu za ovu akciju. OWNER nalog je zaštićen.'
          : `${getErrorMessage(caught)} Osveži pregled da proveriš trenutno stanje naloga.`)
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (mountedRef.current) setBusy(false)
    }
  }

  const selectedName = confirming ? `${confirming.user.firstName} ${confirming.user.lastName} (${confirming.user.email})` : ''
  return <section className="container owner-page page-space">
    <OwnerNavigation />
    <nav className="breadcrumbs" aria-label="Putanja"><Link to="/">Početna</Link><Icon name="chevron-right" size={14} /><span aria-current="page">Upravljanje korisnicima</span></nav>
    <div className="owner-page-heading">
      <div><p className="eyebrow">TRIVIO / VLASNIČKI PANEL</p><h1 className="page-title">Korisnici. Na jednom mestu.</h1><p className="page-description">Pregledaj naloge, upravljaj pristupom i održavaj svoju zajednicu.</p></div>
      <button type="button" className="button button-secondary" onClick={retry} disabled={isLoading || busy}><Icon name="refresh" size={18} />Osveži pregled</button>
    </div>
    {notice && <p className="form-notice" role="status"><Icon name="check" size={18} />{notice}</p>}
    {users && !isLoading && !error && <div className="owner-summary users-summary" aria-label="Pregled korisnika">
      <div><Icon name="user" size={24} /><span>Ukupno naloga<strong>{users.length}</strong></span></div>
      <div><Icon name="check-circle" size={24} /><span>Aktivni nalozi<strong>{users.filter(user => user.enabled).length}</strong></span></div>
      <div><Icon name="lock" size={24} /><span>Banovani nalozi<strong>{users.filter(user => !user.enabled).length}</strong></span></div>
    </div>}
    <div className="owner-filters users-filters">
      <div className="owner-search"><Icon name="search" size={19} /><input type="search" aria-label="Pretraži korisnike" placeholder="Ime, prezime, email ili ID…" maxLength={254} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></div>
      <div><label htmlFor="users-status">Status naloga</label><select id="users-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">Svi statusi</option><option value="active">Aktivni</option><option value="banned">Banovani</option></select></div>
      <div><label htmlFor="users-role">Uloga</label><select id="users-role" value={role} onChange={event => { setRole(event.target.value); setPage(1) }}><option value="">Sve uloge</option><option value="CUSTOMER">Kupci</option><option value="ADMIN">Administratori</option><option value="OWNER">Vlasnik</option></select></div>
    </div>
    <div className="owner-results-bar"><p aria-live="polite">{isLoading ? 'Učitavamo korisnike…' : error ? 'Korisnici nisu učitani' : <><strong>{filtered.length}</strong> {filtered.length === 1 ? 'nalog' : 'naloga'}</>}
      {hasFilters && <button type="button" className="text-link" onClick={() => { setQuery(''); setRole(''); setStatus(''); setPage(1) }}>Poništi filtere<Icon name="close" size={14} /></button>}</p></div>
    {isLoading ? <AsyncState kind="loading" title="Učitavamo korisnike…" />
      : error ? <AsyncState kind="error" title="Korisnici nisu učitani" description={getErrorMessage(error)} onRetry={retry} />
        : filtered.length === 0 ? <AsyncState kind="empty" title="Nema korisnika za ove kriterijume" description="Promeni pretragu ili filtere." />
          : <>
            <div className="users-table-scroll">
              <table className="users-table">
                <caption className="sr-only">Pregled korisnika i akcije upravljanja nalozima</caption>
                <thead><tr><th scope="col">Korisnik</th><th scope="col">Uloga</th><th scope="col">Status</th><th scope="col">Registrovan</th><th scope="col">Akcije</th></tr></thead>
                <tbody>{visible.map(user => {
                  const protectedAccount = user.role === 'OWNER' || user.id === owner?.id
                  return <tr key={user.id}>
                    <th scope="row"><div className="users-identity"><Avatar user={user} /><div><strong>{user.firstName} {user.lastName}{user.id === owner?.id && <span className="users-you">Ti</span>}</strong><span>{user.email}</span><small>#{user.id}</small></div></div></th>
                    <td>{roleLabels[user.role]}</td>
                    <td><span className={`users-status ${user.enabled ? 'is-active' : 'is-banned'}`}><Icon name={user.enabled ? 'check-circle' : 'lock'} size={14} />{user.enabled ? 'Aktivan' : 'Banovan'}</span></td>
                    <td className="users-date">{formatDate(user.createdAt)}</td>
                    <td>{protectedAccount ? <span className="users-protected"><Icon name="shield" size={15} />Zaštićen nalog</span> : <div className="users-actions">
                      <button type="button" className="button button-secondary button-small" disabled={busy} aria-label={`${user.enabled ? 'Banuj nalog' : 'Ukloni ban'}: ${user.email}`} onClick={() => openConfirmation(user, user.enabled ? 'ban' : 'unban')}><Icon name={user.enabled ? 'lock' : 'refresh'} size={15} />{user.enabled ? 'Banuj' : 'Ukloni ban'}</button>
                      <button type="button" className="button button-small users-delete" disabled={busy} aria-label={`Obriši nalog: ${user.email}`} onClick={() => openConfirmation(user, 'delete')}><Icon name="trash" size={15} />Obriši</button>
                    </div>}</td>
                  </tr>
                })}</tbody>
              </table>
            </div>
            {totalPages > 1 && <nav className="users-pagination" aria-label="Stranice korisnika"><button type="button" className="button button-secondary button-small" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><Icon name="arrow-left" size={16} />Prethodna</button><span aria-live="polite">Stranica {currentPage} od {totalPages}</span><button type="button" className="button button-secondary button-small" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Sledeća<Icon name="arrow-right" size={16} /></button></nav>}
          </>}
    <p className="session-note"><Icon name="shield" size={16} />OWNER nalog je zaštićen. Ban blokira prijavu i pristup nalogu. Brisanje naloga je trajno; istorija porudžbina ostaje sačuvana.</p>
    {confirming && <ConfirmDialog title={confirming.action === 'delete' ? 'Obriši korisnički nalog?' : confirming.action === 'ban' ? 'Banuj korisnički nalog?' : 'Ukloni ban sa naloga?'}
      description={confirming.action === 'delete' ? `Nalog ${selectedName} biće trajno obrisan. Ovu radnju nije moguće opozvati. Istorija porudžbina ostaje sačuvana.`
        : confirming.action === 'ban' ? `Korisnik ${selectedName} izgubiće pristup nalogu, uključujući postojeću sesiju. Ban možeš kasnije ukloniti.`
          : `Korisnik ${selectedName} ponovo će moći da se prijavi i koristi svoj nalog.`}
      confirmLabel={actionLabels[confirming.action]} danger={confirming.action === 'delete'} busy={busy} error={actionError}
      onCancel={() => { setConfirming(null); setActionError(null) }} onConfirm={() => { void performAction() }} />}
  </section>
}
