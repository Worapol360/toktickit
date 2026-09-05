import { useEffect, useState, type FormEvent } from 'react';

type Category = { id: number; code: string; name: string; isActive: boolean };
type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  status: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
};
type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};
type Sort = { sortBy: string; sortOrder: 'asc' | 'desc' };
type MyTicketsProps = { requesterId: string; onCreateTicket: () => void; onViewTicket: (ticketId: number) => void };

const defaultPagination: Pagination = { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false };
const defaultSort: Sort = { sortBy: 'createdAt', sortOrder: 'desc' };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function MyTickets({ requesterId, onCreateTicket, onViewTicket }: MyTicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [sort, setSort] = useState(defaultSort);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCategories = async () => {
    const response = await fetch('/api/categories');
    const body = await response.json() as { categories?: Category[] };
    if (!response.ok || !Array.isArray(body.categories)) throw new Error('Unable to load categories.');
    setCategories(body.categories.filter((category) => category.isActive));
  };

  const loadTickets = async (nextPage = page) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (categoryId) params.set('categoryId', categoryId);
    if (sort.sortBy !== defaultSort.sortBy) params.set('sortBy', sort.sortBy);
    if (sort.sortOrder !== defaultSort.sortOrder) params.set('sortOrder', sort.sortOrder);
    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));

    try {
      const response = await fetch(`/api/tickets?${params.toString()}`, { headers: { 'X-Requester-Id': requesterId } });
      const body = await response.json() as { tickets?: Ticket[]; pagination?: Pagination; sort?: Sort; error?: { message?: string } };
      if (!response.ok || !body.pagination || !Array.isArray(body.tickets)) throw new Error(body.error?.message ?? 'Unable to load tickets.');
      setTickets(body.tickets);
      setPagination(body.pagination);
      if (body.sort) setSort(body.sort);
    } catch (loadError) {
      setTickets([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategoryId('');
    setPage(1);
    setPageSize(10);
    setSort(defaultSort);
    setTickets([]);
    void Promise.all([loadTickets(1), loadCategories()]).catch(() => undefined);
    // Requester changes intentionally reset all list state before reloading page one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requesterId]);

  const hasActiveFilters = Boolean(search.trim() || status || priority || categoryId);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    void loadTickets(1);
  };

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
    window.setTimeout(() => void loadTickets(1), 0);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategoryId('');
    setPage(1);
    setSort(defaultSort);
    void loadTickets(1);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void loadTickets(nextPage);
  };

  const isEmpty = !loading && !error && pagination.totalItems === 0 && !hasActiveFilters;
  const isNoResults = !loading && !error && pagination.totalItems === 0 && hasActiveFilters;

  return (
    <section className="my-tickets-page" aria-labelledby="my-tickets-title">
      <div className="my-tickets-heading"><div><h1 id="my-tickets-title">My Tickets</h1><p>View and manage tickets submitted by the selected requester.</p></div>{!isEmpty && <button type="button" className="primary-action" onClick={onCreateTicket}>Create Ticket</button>}</div>
      <form className="ticket-filters" onSubmit={submitSearch} aria-label="Ticket filters">
        <label>Search tickets<input aria-label="Search tickets" placeholder="Ticket number or summary" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Category<select aria-label="Category filter" value={categoryId} onChange={(event) => updateFilter(setCategoryId, event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Requested Priority<select aria-label="Requested Priority filter" value={priority} onChange={(event) => updateFilter(setPriority, event.target.value)}><option value="">All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Current Status<select aria-label="Current Status filter" value={status} onChange={(event) => updateFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="New">New</option></select></label>
        <label>Sort by<select aria-label="Sort by" value={sort.sortBy} onChange={(event) => { setSort({ ...sort, sortBy: event.target.value }); setPage(1); void loadTickets(1); }}><option value="createdAt">Created Date</option><option value="ticketNumber">Ticket Number</option><option value="summary">Summary</option><option value="requestedPriority">Requested Priority</option><option value="status">Status</option></select></label>
        <label>Direction<select aria-label="Sort direction" value={sort.sortOrder} onChange={(event) => { setSort({ ...sort, sortOrder: event.target.value as 'asc' | 'desc' }); setPage(1); void loadTickets(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <label>Page size<select aria-label="Page size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); void loadTickets(1); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
        <button type="submit" className="secondary-action">Search</button>{!isNoResults && <button type="button" className="secondary-action" onClick={clearFilters} disabled={!hasActiveFilters && sort.sortBy === 'createdAt' && sort.sortOrder === 'desc'}>Clear Filters</button>}
      </form>
      <div className="ticket-list-region" aria-live="polite" aria-busy={loading}>
        {loading && <p role="status">Loading tickets...</p>}
        {error && <div role="alert" className="error-banner">{error}<button type="button" onClick={() => void loadTickets(1)}>Retry</button></div>}
        {isEmpty && <div className="state-panel"><h2>No tickets submitted yet</h2><p>Submit a ticket to see it here.</p><button type="button" className="primary-action" onClick={onCreateTicket}>Create Ticket</button></div>}
        {isNoResults && <div className="state-panel"><h2>No matching tickets found</h2><p>Try changing your search or filters.</p><button type="button" className="secondary-action" onClick={clearFilters}>Clear Filters</button></div>}
        {!loading && !error && tickets.length > 0 && <><p className="result-summary">Showing {(pagination.page - 1) * pagination.pageSize + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} tickets</p><table className="tickets-table"><caption>My tickets</caption><thead><tr><th scope="col">Ticket No.</th><th scope="col">Created Date</th><th scope="col">Summary</th><th scope="col">Category</th><th scope="col">Requested Priority</th><th scope="col">Current Status</th><th scope="col">Last Updated</th><th scope="col">Actions</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.ticketNumber}</td><td>{formatDate(ticket.createdAt)}</td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td><span className="badge priority-badge">{ticket.requestedPriority}</span></td><td><span className="badge status-badge">{ticket.status}</span></td><td>{formatDate(ticket.updatedAt)}</td><td><button type="button" onClick={() => onViewTicket(ticket.id)}>View details</button></td></tr>)}</tbody></table><div className="ticket-cards">{tickets.map((ticket) => <article className="ticket-card" key={ticket.id}><h2>{ticket.ticketNumber}</h2><p>{ticket.summary}</p><dl><dt>Category</dt><dd>{ticket.category.name}</dd><dt>Priority</dt><dd>{ticket.requestedPriority}</dd><dt>Status</dt><dd>{ticket.status}</dd><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd><dt>Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></dl><button type="button" aria-label={`View details for ${ticket.ticketNumber}`} onClick={() => onViewTicket(ticket.id)}>View details</button></article>)}</div><nav className="pagination" aria-label="Ticket pages"><button type="button" disabled={!pagination.hasPreviousPage} onClick={() => changePage(page - 1)}>Previous</button>{Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => changePage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={!pagination.hasNextPage} onClick={() => changePage(page + 1)}>Next</button></nav></>}
      </div>
    </section>
  );
}