import { Layers, Clock3, LoaderCircle, CircleCheck } from 'lucide-react';
import { ErrorState } from './States.jsx';

const metrics = [
  { key: 'total', label: 'Total tickets', hint: 'Across all statuses', icon: Layers, color: 'indigo' },
  { key: 'open', label: 'Open', hint: 'Ready for your attention', icon: Clock3, color: 'amber' },
  { key: 'inProgress', label: 'In progress', hint: 'Currently being worked on', icon: LoaderCircle, color: 'blue' },
  { key: 'resolved', label: 'Resolved', hint: 'Customer requests completed', icon: CircleCheck, color: 'green' },
];
export default function SummaryCards({ resource }) {
  if (resource.error) return <ErrorState error={resource.error} retry={resource.refresh} compact />;
  return <section className="summary-grid" aria-label="Global ticket summary" aria-busy={resource.loading}>{metrics.map(({ key, label, hint, icon: Icon, color }) => <article key={key} className={`summary-card metric-${color}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={19} /></span></div><div className="metric-value">{resource.loading ? <span className="skeleton metric-placeholder" /> : resource.data[key].toLocaleString()}{key !== 'total' && !resource.loading && <span className="metric-percent">{resource.data.total ? Math.round(resource.data[key] / resource.data.total * 100) : 0}% of total</span>}</div><p>{hint}</p></article>)}</section>;
}
