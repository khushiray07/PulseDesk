import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/tickets.js';

export function StatusBadge({ value }) {
  return <span className={`badge status-${value.toLowerCase()}`}><span className="badge-dot" />{STATUS_LABELS[value]}</span>;
}
export function PriorityBadge({ value }) {
  const Icon = value === 'HIGH' ? ArrowUp : value === 'LOW' ? ArrowDown : Minus;
  return <span className={`badge priority-${value.toLowerCase()}`}><Icon size={12} strokeWidth={2.5} />{PRIORITY_LABELS[value]}</span>;
}
