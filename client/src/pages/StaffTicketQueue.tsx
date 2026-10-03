import { useEffect, useState, type FormEvent } from 'react';

type Category = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type Owner = {
  id: number;
  name: string;
};

type Ticket = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  status: string;
  owner: Owner | null;
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

type Sort = {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

type StaffTicketQueueProps = {
  onOpenTicket: (ticketId: number) => void;
};

const defaultPagination: Pagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const defaultSort: Sort = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const statuses = [
  'New',
  'Open',
  'In Progress',
  'Waiting for Requester',
  'Resolved',
  'Closed',
  'Reopened',
  'Cancelled',
];

const priorities = ['Low', 'Medium', 'High', 'Urgent'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function StaffTicketQueue({
  onOpenTicket,
}: StaffTicketQueueProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>(defaultPagination);
  const [sort, setSort] = useState<Sort>(defaultSort);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [itPriority, setItPriority] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const loadCategories = async () => {
    const response = await fetch('/api/categories', {
      credentials: 'same-origin',
    });

    const body = (await response.json()) as {
      categories?: Category[];
    };

    if (!response.ok || !Array.isArray(body.categories)) {
      throw new Error('Unable to load categories.');
    }

    setCategories(
      body.categories.filter((category) => category.isActive),
    );
  };

  const loadTickets = async (nextPage: number) => {
    setLoading(true);
    setError('');
    setForbidden(false);

    const params = new URLSearchParams();

    if (appliedSearch.trim()) {
      params.set('search', appliedSearch.trim());
    }

    if (status) {
      params.set('status', status);
    }

    if (itPriority) {
      params.set('itPriority', itPriority);
    }

    if (ownerId) {
      params.set('ownerId', ownerId);
    }

    if (categoryId) {
      params.set('categoryId', categoryId);
    }

    if (sort.sortBy !== defaultSort.sortBy) {
      params.set('sortBy', sort.sortBy);
    }

    if (sort.sortOrder !== defaultSort.sortOrder) {
      params.set('sortOrder', sort.sortOrder);
    }

    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));

    try {
      const response = await fetch(
        `/api/staff/tickets?${params.toString()}`,
        {
          credentials: 'same-origin',
        },
      );

      const body = (await response.json()) as {
        tickets?: Ticket[];
        pagination?: Pagination;
        sort?: Sort;
        error?: {
          message?: string;
        };
      };

      if (response.status === 403) {
        setForbidden(true);
        setTickets([]);
        return;
      }

      if (
        !response.ok ||
        !body.pagination ||
        !Array.isArray(body.tickets)
      ) {
        throw new Error(
          body.error?.message ?? 'Unable to load tickets.',
        );
      }

      setTickets(body.tickets);
      setPagination(body.pagination);

      if (body.sort) {
        setSort(body.sort);
      }

      setOwners((currentOwners) => {
        const merged = new Map(
          currentOwners.map((owner) => [owner.id, owner]),
        );

        body.tickets?.forEach((ticket) => {
          if (ticket.owner) {
            merged.set(ticket.owner.id, ticket.owner);
          }
        });

        return Array.from(merged.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
    } catch (loadError) {
      setTickets([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load tickets.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories().catch(() => {
      setError('Unable to load categories.');
    });
  }, []);

  useEffect(() => {
    void loadTickets(page);
    // loadTickets intentionally depends on the filter state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedSearch,
    status,
    itPriority,
    ownerId,
    categoryId,
    sort.sortBy,
    sort.sortOrder,
    page,
    pageSize,
  ]);

  const hasActiveFilters = Boolean(
    appliedSearch.trim() ||
      status ||
      itPriority ||
      ownerId ||
      categoryId,
  );

  const isEmpty =
    !loading &&
    !error &&
    !forbidden &&
    pagination.totalItems === 0 &&
    !hasActiveFilters;

  const isNoResults =
    !loading &&
    !error &&
    !forbidden &&
    pagination.totalItems === 0 &&
    hasActiveFilters;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const updateFilter = (
    setter: (value: string) => void,
    value: string,
  ) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setStatus('');
    setItPriority('');
    setOwnerId('');
    setCategoryId('');
    setSort(defaultSort);
    setPage(1);
  };

  return (
    <section
      className="my-tickets-page staff-ticket-queue"
      aria-labelledby="staff-ticket-queue-title"
    >
      <div className="my-tickets-heading">
        <div>
          <h1 id="staff-ticket-queue-title">Ticket Queue</h1>
          <p>View and manage tickets in the IT Staff queue.</p>
        </div>
      </div>

      <form
        className="ticket-filters"
        onSubmit={submitSearch}
        aria-label="Ticket filters"
      >
        <label>
          Search tickets
          <input
            aria-label="Search tickets"
            placeholder="Ticket number, summary, or requester"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          Status
          <select
            aria-label="Status filter"
            value={status}
            onChange={(event) =>
              updateFilter(setStatus, event.target.value)
            }
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          IT Priority
          <select
            aria-label="IT Priority filter"
            value={itPriority}
            onChange={(event) =>
              updateFilter(setItPriority, event.target.value)
            }
          >
            <option value="">All priorities</option>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Ticket Owner
          <select
            aria-label="Owner filter"
            value={ownerId}
            onChange={(event) =>
              updateFilter(setOwnerId, event.target.value)
            }
          >
            <option value="">All owners</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Category
          <select
            aria-label="Category filter"
            value={categoryId}
            onChange={(event) =>
              updateFilter(setCategoryId, event.target.value)
            }
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort by
          <select
            aria-label="Sort by"
            value={sort.sortBy}
            onChange={(event) => {
              setSort({
                ...sort,
                sortBy: event.target.value,
              });
              setPage(1);
            }}
          >
            <option value="createdAt">Created Date</option>
            <option value="ticketNumber">Ticket Number</option>
            <option value="itPriority">IT Priority</option>
            <option value="status">Status</option>
            <option value="updatedAt">Last Updated</option>
          </select>
        </label>

        <label>
          Direction
          <select
            aria-label="Sort direction"
            value={sort.sortOrder}
            onChange={(event) => {
              setSort({
                ...sort,
                sortOrder: event.target.value as 'asc' | 'desc',
              });
              setPage(1);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>

        <button type="submit" className="secondary-action">
          Search
        </button>

        <button
          type="button"
          className="secondary-action"
          onClick={clearFilters}
          disabled={
            !hasActiveFilters &&
            sort.sortBy === 'createdAt' &&
            sort.sortOrder === 'desc'
          }
        >
          Clear Filters
        </button>
      </form>

      <div
        className="ticket-list-region"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && <p role="status">Loading tickets...</p>}

        {forbidden && (
          <div role="alert" className="error-banner">
            <h2>Access forbidden</h2>
            <p>
              You do not have permission to access the Ticket Queue.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button
              type="button"
              onClick={() => void loadTickets(1)}
            >
              Retry
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="state-panel">
            <h2>No tickets found</h2>
            <p>There are no tickets in the queue yet.</p>
          </div>
        )}

        {isNoResults && (
          <div className="state-panel">
            <h2>No matching tickets found</h2>
            <p>Try changing your search or filters.</p>
            <button
              type="button"
              className="secondary-action"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          !forbidden &&
          tickets.length > 0 && (
            <>
              <p className="result-summary">
                Showing{' '}
                {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalItems,
                )}{' '}
                of {pagination.totalItems} tickets
              </p>

              <table className="tickets-table">
                <caption>IT Staff ticket queue</caption>

                <thead>
                  <tr>
                    <th scope="col">Ticket No.</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Requested Priority</th>
                    <th scope="col">IT Priority</th>
                    <th scope="col">Current Status</th>
                    <th scope="col">Ticket Owner</th>
                    <th scope="col">Last Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.ticketNumber}</td>
                      <td>{formatDate(ticket.createdAt)}</td>
                      <td>{ticket.summary}</td>
                      <td>{ticket.category.name}</td>

                      <td>
                        <span className="badge priority-badge">
                          {ticket.requestedPriority}
                        </span>
                      </td>

                      <td>
                        <span className="badge priority-badge">
                          {ticket.itPriority ?? 'Not set'}
                        </span>
                      </td>

                      <td>
                        <span className="badge status-badge">
                          {ticket.status}
                        </span>
                      </td>

                      <td>
                        {ticket.owner ? (
                          ticket.owner.name
                        ) : (
                          <span className="badge ownership-badge">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td>{formatDate(ticket.updatedAt)}</td>

                      <td>
                        <button
                          type="button"
                          onClick={() => onOpenTicket(ticket.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ticket-cards">
                {tickets.map((ticket) => (
                  <article className="ticket-card" key={ticket.id}>
                    <h2>{ticket.ticketNumber}</h2>
                    <p>{ticket.summary}</p>

                    <dl>
                      <dt>Status</dt>
                      <dd>
                        <span className="badge status-badge">
                          {ticket.status}
                        </span>
                      </dd>

                      <dt>IT Priority</dt>
                      <dd>
                        <span className="badge priority-badge">
                          {ticket.itPriority ?? 'Not set'}
                        </span>
                      </dd>

                      <dt>Owner</dt>
                      <dd>
                        {ticket.owner ? (
                          ticket.owner.name
                        ) : (
                          <span className="badge ownership-badge">
                            Unassigned
                          </span>
                        )}
                      </dd>

                      <dt>Created</dt>
                      <dd>{formatDate(ticket.createdAt)}</dd>

                      <dt>Updated</dt>
                      <dd>{formatDate(ticket.updatedAt)}</dd>
                    </dl>

                    <button
                      type="button"
                      aria-label={`Open ${ticket.ticketNumber}`}
                      onClick={() => onOpenTicket(ticket.id)}
                    >
                      Open
                    </button>
                  </article>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <nav
                  className="pagination"
                  aria-label="Ticket pages"
                >
                  <button
                    type="button"
                    disabled={!pagination.hasPreviousPage}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>

                  {Array.from(
                    { length: pagination.totalPages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      aria-current={
                        pageNumber === page ? 'page' : undefined
                      }
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
      </div>
    </section>
  );
}