import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPage }) {
  const { page, total, totalPages, limit } = pagination;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  return <div className="pagination"><p>Showing <strong>{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> tickets</p><nav aria-label="Ticket pagination"><button className="page-arrow" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /><span>Previous</span></button>{pages.map((number) => <button key={number} className={`page-number ${page === number ? 'selected' : ''}`} aria-label={`Page ${number}`} aria-current={page === number ? 'page' : undefined} onClick={() => onPage(number)}>{number}</button>)}<button className="page-arrow" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><span>Next</span><ChevronRight size={17} /></button></nav></div>;
}
