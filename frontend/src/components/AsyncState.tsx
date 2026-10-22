import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function AsyncState({ kind, title, description, onRetry, action }: {
  kind: 'loading' | 'error' | 'empty'; title: string; description?: string;
  onRetry?: () => void; action?: ReactNode;
}) {
  return <div className={`async-state async-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className={`state-symbol ${kind === 'loading' ? 'is-spinning' : ''}`}>
      <Icon name={kind === 'loading' ? 'refresh' : kind === 'error' ? 'alert' : 'car'} size={26} />
    </span>
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {onRetry && <button type="button" className="button button-secondary" onClick={onRetry}>
      <Icon name="refresh" size={17} /> Pokušaj ponovo
    </button>}
    {action}
  </div>;
}
