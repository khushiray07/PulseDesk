import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PriorityBadge, StatusBadge } from './Badge.jsx';
import { fullDate, relativeDate, shortId } from '../utils/tickets.js';

function TicketTitle({ ticket, target }) {
  return <div className="ticket-title-cell"><span className="ticket-number">{shortId(ticket.id)}{ticket.priority === 'HIGH' && ticket.status === 'OPEN' && <span className="attention-dot" title="Needs attention: High priority and Open" aria-label="Needs attention" />}</span><Link to={target} className="ticket-title">{ticket.title}</Link><p className="ticket-excerpt">{ticket.description}</p></div>;
}
export default function TicketList({ tickets, returnTo }) {
  const target = (ticket) => `/tickets/${ticket.id}?returnTo=${encodeURIComponent(returnTo)}`;
  return <>
    <div className="desktop-tickets"><table><caption className="sr-only">Support tickets</caption><thead><tr><th scope="col">Ticket / Issue</th><th scope="col">Customer</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Created / Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><TicketTitle ticket={ticket} target={target(ticket)} /></td><td><div className="customer-cell"><span className="customer-avatar">{ticket.customerEmail[0].toUpperCase()}</span><span title={ticket.customerEmail}>{ticket.customerEmail}</span></div></td><td><PriorityBadge value={ticket.priority} /></td><td><StatusBadge value={ticket.status} /></td><td className="date-cell"><time dateTime={ticket.createdAt} title={fullDate(ticket.createdAt)}>{relativeDate(ticket.createdAt)}</time><span title={fullDate(ticket.updatedAt)}>Updated {relativeDate(ticket.updatedAt)}</span></td><td><Link className="row-action" to={target(ticket)} aria-label={`View ticket: ${ticket.title}`}><ArrowUpRight size={18} /></Link></td></tr>)}</tbody></table></div>
    <div className="mobile-tickets">{tickets.map((ticket) => <article className="ticket-mobile-card" key={ticket.id}><div className="mobile-card-top"><StatusBadge value={ticket.status} /><PriorityBadge value={ticket.priority} /></div><TicketTitle ticket={ticket} target={target(ticket)} /><p className="mobile-email">{ticket.customerEmail}</p><div className="mobile-card-bottom"><div><time dateTime={ticket.createdAt}>Created {relativeDate(ticket.createdAt)}</time><time dateTime={ticket.updatedAt}>Updated {relativeDate(ticket.updatedAt)}</time></div><Link to={target(ticket)}>View ticket <ArrowUpRight size={14} /></Link></div></article>)}</div>
  </>;
}
