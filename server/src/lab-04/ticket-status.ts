export const STATUS_TRANSITIONS: Record<string, string[]> = {
  'New': ['Open', 'Cancelled'],
  'Open': ['In Progress', 'Cancelled'],
  'In Progress': ['Waiting for Requester', 'Resolved', 'Cancelled'],
  'Waiting for Requester': ['In Progress', 'Resolved', 'Cancelled'],
  'Resolved': ['Closed', 'Reopened'],
  'Closed': ['Reopened'],
  'Reopened': ['In Progress', 'Cancelled'],
  'Cancelled': []
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
