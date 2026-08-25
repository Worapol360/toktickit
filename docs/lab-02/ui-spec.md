# Lab 2 Requester UI Specification

## 1. Purpose and visual direction

This specification defines the responsive Requester-facing interface for Lab 2. The visual direction is a calm, professional service-desk experience: a deep green application shell, pale green highlights, white work surfaces, restrained borders, compact controls, and clear hierarchy. The interface must support the Development Requester Selection screen, Create Ticket, My Tickets, and Ticket Detail views.

The rules below are implementation- and test-oriented. A visual inspection must verify the tokens, dimensions, states, responsive behavior, and accessibility behavior rather than matching a screenshot by pixel alone.

## 2. Design tokens

### 2.1 Color tokens

| Token | Value | Intended use |
|---|---|---|
| `--color-primary` | `#006B3C` | Application header, primary buttons, active navigation, links, success emphasis |
| `--color-primary-hover` | `#0B7A46` | Hover and pressed state for primary controls; never use as the default background |
| `--color-primary-active` | `#00552F` | Keyboard focus/pressed reinforcement where additional contrast is needed |
| `--color-page` | `#F6FAF8` | Main page background; use behind content surfaces |
| `--color-pale` | `#EAF6EF` | Selected rows, informational panels, soft success backgrounds, requester-context highlights |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables, dialogs, and ticket detail surfaces |
| `--color-surface-muted` | `#F3F6F4` | Read-only fields, disabled controls, skeleton backgrounds, secondary surfaces |
| `--color-border` | `#D7E2DC` | Default control, card, table, and divider borders |
| `--color-border-strong` | `#AFC5B8` | Hovered or emphasized borders and table boundaries |
| `--color-text` | `#17221C` | Primary headings, labels, ticket values, and body copy |
| `--color-text-muted` | `#5D6B63` | Supporting text, timestamps, helper text, and placeholders |
| `--color-text-on-primary` | `#FFFFFF` | Text and icons on primary green surfaces |
| `--color-error` | `#B42318` | Validation messages, destructive actions, failure banners, and invalid borders |
| `--color-error-bg` | `#FDECEC` | Error banner and invalid-field background |
| `--color-warning` | `#9A6700` | Warning state, pending attention, and attachment limit notices |
| `--color-warning-bg` | `#FFF7DB` | Warning badges and warning callouts |
| `--color-success` | `#18794E` | Successful completion, active/healthy status, and confirmation messaging |
| `--color-success-bg` | `#E7F5EC` | Success banner, active attachment, and positive status badge background |
| `--color-info` | `#176B87` | Neutral information callouts and informational icons |
| `--color-info-bg` | `#EAF6F7` | Informational panels such as development-context guidance |

Color must not be the only status indicator. Pair each semantic color with text, an icon, a label, or a pattern. Text and controls must meet WCAG AA contrast requirements; primary button text must remain clearly readable against `--color-primary` and `--color-primary-hover`.

### 2.2 Typography

Use one highly legible sans-serif family consistently across the application. Use the following scale; do not scale font size with viewport width.

| Token | Size / line height | Use |
|---|---:|---|
| `--font-display` | 32px / 40px, weight 700 | Page title on desktop |
| `--font-heading` | 24px / 32px, weight 700 | Major card or detail heading |
| `--font-subheading` | 18px / 26px, weight 700 | Section heading |
| `--font-body` | 14px / 22px, weight 400 | Standard body and table text |
| `--font-label` | 13px / 18px, weight 600 | Form labels and column headings |
| `--font-caption` | 12px / 18px, weight 400 | Helper text, metadata, timestamps |
| `--font-button` | 14px / 20px, weight 600 | All button labels |

On mobile, page titles may use 24px / 32px and major headings 20px / 28px. Body and control text must not be smaller than 14px, except for nonessential metadata which may use 12px.

### 2.3 Spacing and shape

Use a 4px base spacing unit: `4`, `8`, `12`, `16`, `20`, `24`, `32`, `40`, and `48px`. Use `16px` page gutters on mobile, `24px` on tablet, and `32px` on desktop. Content containers are capped at `1200px` and centered.

Controls have a minimum height of `40px`; primary actions have a minimum height of `44px`. Default control radius is `6px`; cards use `8px`; badges and status pills use `999px`. Use a `1px` border and a restrained shadow (`0 2px 8px rgba(23, 34, 28, 0.08)`) only on elevated surfaces such as dialogs and main workflow cards.

## 3. Application shell and navigation

The shell contains:

- A deep green top navigation bar with the TikTockIT brand at the leading edge.
- Active navigation for `My Tickets`, shown with a pale or white active indicator and a visible text label.
- A `Create Ticket` navigation action.
- A Profile/context area on the trailing edge. In Lab 2 it exposes the active development requester and a way to change context; it must be labeled as testing context, not authentication.
- A responsive breadcrumb or page-context row below the header where useful, including `Development Requester Selection` on the selector screen.

The shell must remain usable at every breakpoint. On mobile, navigation may collapse into a menu, but `My Tickets`, `Create Ticket`, active requester context, and the current page title must remain discoverable and keyboard accessible. The current route must have an `aria-current="page"` equivalent and a non-color active indicator.

## 4. Screens and workflow states

### 4.1 Development Requester Selection

Present a centered surface within the page background. It contains a title, concise testing-only explanation, a required `Development Requester` select control, an informational callout that only active requesters are shown, and `Cancel` / `Continue` actions.

The select is editable until submission. `Continue` is disabled until a requester is selected, enters the busy state while context is being established, and then routes to the requester workspace. The selected requester must be shown in the shell context after success. A failed load or context change preserves the current selection and shows a failure banner with a retry action.

### 4.2 Create Ticket

Use a single readable form surface with grouped metadata and description fields. Required fields are Summary, Description, Category, Related System, and Requested Priority. The form includes an attachment selector and a clear action row.

The form must preserve all entered values and selected files when server or network submission fails. On success, show a confirmation containing the generated ticket number and a link to the new ticket detail or My Tickets. The requester must not be able to edit ticket status after creation.

### 4.3 My Tickets

The page begins with a title and supporting text, followed by `Clear Filters` and `Create Ticket` actions. Search, filters, sort, and pagination must be grouped in a dedicated control region. Filter changes reset the current page to 1 and refresh the result set.

### 4.4 Ticket Detail

Show a read-only ticket summary and metadata surface. The ticket number and current status are prominent. Display Summary, Description, Category, Related System, Requested Priority, Created Date, and Last Updated as labeled values. There are no requester controls for changing ticket status, priority, category, or description.

The detail view includes an attachment history region. Active attachments expose preview where supported and download. Removed or unavailable attachments expose metadata and an explanatory state, but no preview or download action.

## 5. Controls, validation, and actions

### 5.1 Control states

Every input, select, search field, and button must support these explicit states:

| State | Visual rule | Behavioral rule |
|---|---|---|
| Editable | White surface, `--color-border`, dark text | Accepts pointer and keyboard input |
| Read-only | `--color-surface-muted`, muted border/text, no edit affordance | Value is selectable but cannot be changed |
| Invalid | `--color-error` border, error icon or marker, error text below | `aria-invalid="true"`; submission is blocked until corrected |
| Disabled | Muted surface and text with reduced contrast but readable label | Not interactive; must not be the sole indication of unavailable state |
| Focused | 2px `--color-primary` outline with at least 2px offset | Visible for keyboard focus; never remove the browser focus indication without replacement |
| Busy | Disabled interaction, spinner or progress indicator, explicit busy label | Must expose `aria-busy` or equivalent and prevent duplicate activation |

Focus styling must not rely on color alone: use an outline or ring that visibly encloses the control. Disabled controls remain distinguishable from read-only controls through cursor, text, and supporting state treatment.

### 5.2 Required fields and validation

Place a visible `*` after every required field label and include a form-level note that `*` means required. The marker must have an accessible text equivalent such as `required` in the label or description.

Place field-level validation text directly below the related control, before the next field, with an error icon and concise corrective instruction. Do not move focus unexpectedly while the user is typing. On submit, focus the first invalid field and show a form-level summary linking to every invalid field.

Client validation must trim leading and trailing whitespace and enforce the server contract. Summary is 5-100 characters; Description is 10-2000 characters; Category and Related System are required. Preserve entered data when validation or submission fails.

### 5.3 Button hierarchy

| Variant | Appearance and use |
|---|---|
| Primary | `--color-primary` fill with white label; one main action per surface, such as `Continue` or `Create Ticket` |
| Secondary | White or pale surface with primary-colored label and border; supporting action such as `Cancel` or `Clear Filters` |
| Tertiary | Text or icon-plus-text action without filled surface; low-emphasis navigation or retry action |
| Destructive | Error-colored border or fill with explicit action label; attachment removal only, never routine navigation |
| Disabled | Muted surface and label; retains the normal button dimensions and readable text |
| Busy | Same hierarchy color treatment, disabled pointer/keyboard activation, visible spinner, and action label such as `Creating Ticket...` |

Buttons must use action-specific labels. Icon-only buttons require an accessible name and tooltip. A submit button enters busy state immediately and remains disabled until the request resolves.

## 6. Attachments

The attachment selector accepts `JPG`, `JPEG`, `PNG`, `WEBP`, and `PDF`, with a maximum of 5MB per file and 5 active attachments per ticket. Show the accepted formats and limit beside the selector before a file is chosen.

After selection, render each file as a stable row containing file name, type, formatted size, upload state, and a remove action. Do not make the file name the only status indicator.

Attachment states:

| State | Presentation and behavior |
|---|---|
| Active | File metadata, success/active label, preview where supported, download, and remove actions |
| Uploading | Progress indicator or spinner, `Uploading` label, disabled preview/download/remove until resolved |
| Invalid | Error icon, explicit reason such as `File exceeds 5MB` or `Unsupported file type`, and a remove/replace action; block ticket submission |
| Removed | Preserved metadata, `Removed` label, removal reason, muted surface, and disabled/absent preview/download |
| Unavailable | Metadata plus `File unavailable` explanation; no download/preview; provide a retry or support path only when applicable |

Invalid-file errors appear inline in the file row and in the form-level error summary. A failed upload must not silently discard the ticket form; preserve all text fields and valid attachment selections. Attachment removal from Ticket Detail requires a confirmation dialog and a reason of 5-250 characters. The dialog must trap focus, support Escape to cancel, and return focus to the initiating remove button after closing.

## 7. My Tickets controls and presentation

### 7.1 Search, filters, sort, and clear

The control region contains:

- Search input labeled `Search tickets`, with placeholder text that names searchable ticket number or summary. Search covers ticket number, summary, and description.
- Category filter select.
- Requested Priority filter select.
- Current Status filter select.
- Sort control with field and ascending/descending direction. Default is `Created Date`, descending.
- `Clear Filters` secondary action, disabled or hidden when no filter/search differs from defaults.

Each control has a visible label on desktop and an accessible label on mobile. Search must provide a clear value action when populated. Applying or clearing any filter returns to page 1. Loading feedback must identify the list region rather than replacing the whole shell.

### 7.2 Desktop table

At desktop width, use a semantic table with a caption or accessible name. Required columns are:

1. Ticket No.
2. Created Date
3. Summary
4. Category
5. Requested Priority
6. Current Status
7. Last Updated
8. Actions, including a clearly labeled detail action

The table header must expose sort direction for sortable columns using text and an icon or `aria-sort`. Keep ticket number and summary visually prominent. Do not require horizontal scrolling for the standard desktop viewport.

### 7.3 Mobile cards

Below 768px, replace the table with one card per ticket. Each card must show ticket number, summary, status, requested priority, category, created date, last updated date, and a `View details` action. Use a consistent two-column label/value rhythm for metadata and allow long summaries and ticket numbers to wrap without overflow. Cards must not hide required ticket information behind hover-only behavior.

### 7.4 Pagination

Provide explicit Previous, numbered page, and Next controls, with the current page visibly selected and programmatically identified. Show a result summary such as `Showing 1-10 of 42 tickets`. Disable Previous on the first page and Next on the last page. Controls must remain reachable by keyboard and use labels that include the destination page where needed.

### 7.5 Empty and no-results states

An Empty List state appears when the requester has no tickets and no search or filters are active. It explains that no tickets have been submitted and provides a primary `Create Ticket` action.

A No-Results state appears when a search or filter combination returns zero tickets. It explains that no tickets match the current criteria and provides a prominent `Clear Filters` action. These states must be distinct in text and accessible labels; neither may be represented only by an empty table.

## 8. Priority and status badges

Use compact pill badges with text, not color alone. Requested priority uses:

- `Low`: green success treatment.
- `Medium`: amber warning treatment.
- `High`: red/error treatment.
- `Urgent`: red/error treatment with stronger contrast and an urgency icon or text qualifier.

Current status uses:

- `New`: blue/info or pale-green neutral treatment with the text `New`.
- Any future status such as `In Progress`, `Pending`, `Resolved`, or `Closed`: a distinct semantic label and icon treatment consistent with its meaning.

Status is read-only in Lab 2. Badge text must remain visible at mobile widths and meet contrast requirements against its badge background.

## 9. Reusable application states

Every data-driven screen must define these states:

| State | Required presentation |
|---|---|
| Initial | Stable shell and deliberate first-use content; no unexplained blank region |
| Loading | Skeleton rows/cards or control placeholders matching final dimensions; announce loading to assistive technology |
| Validation | Inline field errors plus summary; focus first invalid field; retain all user input |
| Submitting | Busy submit action, disabled duplicate activation, progress announcement |
| Success | Clear confirmation with the resulting ticket number or completed action and an obvious next action |
| Failure | Prominent error banner with actionable retry; retain form values and attachment selections where possible |
| Empty | Intentional zero-data message and relevant creation action |
| No results | Filter-specific message and reset action |

System error banners use `--color-error-bg` and `--color-error`, include an error icon and text, and remain visible until resolved or dismissed. Dismissal must not erase form data.

## 10. Responsive layout rules

### Desktop: >=992px

Use the centered `1200px` maximum content width, `32px` outer gutters, horizontal shell navigation, and the full My Tickets table. Form surfaces may use a two-column metadata grid, while long description and attachments span the full width. Keep primary and secondary actions aligned at the end of the form action row.

### Tablet: 768-991px

Use `24px` outer gutters. Keep the shell and table where the content remains readable; otherwise switch the ticket list to cards before forcing unsafe horizontal compression. Form metadata may remain two columns only when each control retains at least `240px`; collapse to one column when it does not. Filter controls may wrap into two rows.

### Mobile: <768px

Use `16px` outer gutters, one-column forms, stacked filter controls, and ticket cards instead of a table. Primary actions should be full width when stacked. Secondary actions may stack below them. The requester selection surface, dialogs, banners, and attachment rows must fit the viewport without horizontal scrolling. Long text wraps; controls must retain a minimum 40px target height and a minimum 44px target size for primary touch actions.

At all breakpoints, content must not overlap, controls must not shift when loading labels appear, and interactive regions must remain reachable without horizontal scrolling.

## 11. Accessibility requirements

- Every control has a visible label or an accessible name; placeholder text is never the only label.
- Use semantic landmarks, headings in logical order, semantic table markup on desktop, and lists/cards with appropriate grouping on mobile.
- Provide keyboard access with Tab, Shift+Tab, Enter, Space, and Escape where applicable. Focus order follows the visual reading order.
- Use a visible 2px focus ring with sufficient offset on every interactive element.
- Announce loading, submission, validation, success, and failure changes with appropriate live-region semantics without repeatedly interrupting typing.
- Associate helper and error text with its input using accessible descriptions. Mark invalid fields programmatically.
- Provide text and/or icons in addition to color for priority, status, attachment, error, and disabled states.
- Dialogs must have a title, description where needed, focus trapping while open, Escape cancellation where safe, and focus restoration.
- Do not rely on hover for essential information or actions. Touch targets must remain usable on mobile.
- Respect reduced-motion preferences; loading and page transitions must not be required to understand state.

## 12. Visual inspection and evidence

Visual inspection must cover the Development Requester Selection, Create Ticket, My Tickets, Ticket Detail, attachment error/removal dialog, loading, empty, no-results, and failure states at desktop, tablet, and mobile widths.

Required checks:

- Confirm the green shell, pale background, white surfaces, token usage, hierarchy, and readable contrast.
- Confirm no horizontal overflow, clipped labels, overlapping controls, or layout shifts in any required viewport.
- Confirm table-to-card transformation and complete ticket information at mobile width.
- Confirm visible focus indicators and non-color status indicators using keyboard navigation.
- Confirm invalid, uploading, removed, and unavailable attachment states are distinguishable and actionable.
- Confirm error and success states preserve or expose the expected next action.

Save screenshot evidence under:

`artifacts/lab-02/screenshots/<screen>/<viewport>/<state>.png`

Use lowercase kebab-case names. Example: `artifacts/lab-02/screenshots/my-tickets/mobile/no-results.png`. Screenshots must include the full relevant viewport and must be accompanied by the viewport dimensions and state in the inspection record.
