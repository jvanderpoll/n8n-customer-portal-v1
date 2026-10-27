# Customer portal plan

Status: executed for the Wednesday happy path.

Wednesday shows the happy path only (signed-in user with account access, at least one running subscription, usage numbers present, an assigned CSM). Sign-up, sign-in, access denied, empty, missing-data, and error states stay in the plan as later.

## Locked

- Entity name: Subscription. Screen label settled as Subscription (nav: Subscriptions).
- Say quota, not allowance.
- Running and expired subscriptions share the same fields. Running leads with the renewal date. Expired leads with the end date.
- Each running subscription shows: quota, executions used, percent of quota used, period start and end, time left, and whether the quota resets at renewal.
- Two figures side by side: percent of quota used, and percent of the period gone — each with a progress bar of the same size. Color is on the quota bar only (green through 70, then yellow, orange, red). The period bar is plain neutral grey.
- The usage-over-time chart stays.
- Instance actions, license actions, license requests, users, and contact stay, on their own screens, off the subscription view.
- The subscription shows "N instances reporting."
- The instance drill-down is a plain list: name, license, executions, reporting status. No actions on that list.
- Do not invent policies, instance caps, or friendly instance names. If a subscription has no policy in the data, leave that line out.
- Sidebar: no company info box, no sample-data caption, no role switcher. Bottom-left avatar (signed-in initials) opens a menu with Message CSM (/contact), Give feedback (local draft download only), and Log out (navigates to /; no auth).
- Subscriptions list uses Running (n) / Expired (n) tabs (Running default); black text with underline on the active tab. Expired cards are muted (grey text, grey quota bar, neutral badge).
- Counts live in headings ("Instances (40)", "People with access (2)", …). No separate count text or count pills.
- One shared DataTable for every portal table: search, column-header sort, filters behind one filter-icon popover, CSV of the rows currently shown. Table text is black with no link styling; the whole row navigates; the row menu does not. Text hyperlinks elsewhere are black with underline. No orange filled icon tiles or extra colored chips; buttons stay on the shared Button primitive.
- No user-facing prototype disclaimers. Scenario switcher stays without an explanatory paragraph.

### Model

- Account: the customer that owns the licenses and subscriptions.
- Subscription: the purchased commercial terms, including plan, quotas and dates. Belongs to an Account. Defines which licenses each quota covers. The source strikes the synonym Purchase.
- License key: the License Server identifier that connects licensed usage to a Subscription and Account.
- Instance: an identifiable n8n instance. Activation records when a license key is used on an instance. Instances can be production or non-production (test, staging).
- Usage: reported consumption linked to an Instance and attributed to a Subscription and Account for the period being reported.

### Access

- Someone at the customer (often IT) sets up the subscription, then invites other people into the portal.
- Single system-admin role. Members have no role and no per-subscription scope.
- A Users screen: one table of people with access. Columns: name, email, and a row menu (Remove only).
- A primary Invite button at the top opens a dialog asking only for name and email.
- A pending-invites list with name, email, and Cancel.
- Keep this on the Users screen, off the subscription view.

### Principle

- The portal is mostly informational. Information is passive.
- Only a few actions exist.
- The action we want customers to take is to talk to n8n, specifically their CSM (customer success manager).

### Contact

- Entry points to contact the CSM.
- When quota is high or over, the Quota used figure gets a dotted underline and a hover card (short sentence + Contact CSM link with topic=quota). When renewal needs attention, the renewal date gets the same pattern with topic=renewal. No orange banners. No tooltip when status is fine. The card stays open while the pointer moves onto the link.
- Contact stays a real screen too, but the entry points are the point.
- Sidebar avatar also links to Message CSM, Give feedback, and Log out. Feedback and contact create local drafts only; nothing is sent.

### Granularity

- Three levels: subscription, license, instance. A subscription has one or more licenses. A license has one or more instances.
- Show quota and usage only at the levels that actually carry them. Do not force a number onto a level that has none.
- Quota is on the subscription only. Usage is reported on the instance and sums to the license, then to the subscription. A license is a drill-down, not a second quota.

### Tree

The diagram says Purchase; the entity model says Subscription. The tree wins for screen structure.

- Sign-up link sent to the contact recorded in Salesforce
  - Sign up: create login credentials
- Returning user: Sign in
- Account access?
  - No: Access denied / Get help
  - Yes: Customer portal. Account name + navigation
    - Overview: usage, renewal, last update. Requirements only when the contract restricts something.
    - Purchases and licenses
      - Purchase details: plan, period, licenses. Contract requirements if any.
        - License details: covered instances + usage
          - Instance details: billable usage + last report
    - Instances: search and filters
      - Instance details (same)
    - Users: people with access + pending invites
      - Invite or remove a person
    - Contact n8n: assigned CSM + contact action

## Open

- How a subscription relates to instances, and whether a subscription limits how many. Not decided. Do not invent an answer in the UI.
- This "mostly informational" rule is the bias against adding further actions.
- Only production instances are billed. Non-production instances exist and are not billed. Believed, not verified.
- Contact destination fallback remains unresolved; drafts stay local.
- Customizable table columns (show/hide, reorder) later.

## Log

- 2026-10-26: plan opened from the design discussion. Not executed.
- 2026-10-26: locked the Users screen. Read or write, scoped to purchases. Not executed.
- 2026-10-26: locked the informational bias and CSM entry points on the purchase view. Not executed.
- 2026-10-26: locked granularity. Quota on the purchase. Usage rolls up from instances. Not executed.
- 2026-10-26: locked the five-entity model. Entity name is Subscription. Screen label still open. Not executed.
- 2026-10-26: tree adopted from the design-brief flowchart. Not executed.
- 2026-10-26: executed the happy path. Overview, Subscriptions with subscription and license drill-downs, Instances with instance details, Users with read/write and scope, Contact n8n with CSM entry points. Quota is high above 70%; renewal needs attention within 60 days.
- 2026-10-26: screen label settled as Subscription; single system-admin role superseding read/write and per-subscription scope; sidebar reduced to a bottom-left avatar menu (message CSM, give feedback) with the sample-data caption removed; tables carry a working CSV export and the instances table sorts via the URL; customizable columns remain later.
- 2026-10-26: instance detail shows billable executions, share of the subscription, key type, and the subscription quota they count toward. No per-instance price, because the docs don't define one.
- 2026-10-26: visual pass — quota/renewal hover cards replace orange CSM banners; plain grey icons; grey period bar; black underlined text links and black table rows; counts in headings; shared DataTable with search/sort/filter/CSV; Running/Expired tabs; muted expired cards; prototype disclaimers removed; avatar Log out; Access remains a single system admin.
- 2026-10-26: quota and time merged into one bar (quota fill with a time marker labelled % of period); hover cards, help popovers and the topbar Help removed; a plain "Contact <CSM>" link shows only when quota or renewal needs attention; floating menus, dialogs and selects are opaque.
- 2026-10-27: executions are counted per month. A subscription detail lists past months (period, monthly quota, executions, under or over). Amount is calculated from the published Business price, €667 per month for 40,000 executions, because Enterprise is custom. A closed month bills its quota plus executions over that quota. The open month is not billed. The account name is not repeated in the top bar.
