# Customer portal plan

Status: executed for the Wednesday happy path.

Wednesday shows the happy path only (signed-in user with account access, at least one running subscription, usage numbers present, an assigned CSM). Sign-up, sign-in, access denied, empty, missing-data, and error states stay in the plan as later.

## Locked

- Entity name: Subscription. Yury's design brief still says "Purchases and licenses", so the screen label is not fully settled.
- Say quota, not allowance.
- Running and expired subscriptions share the same fields. Running leads with the renewal date. Expired leads with the end date.
- Each running subscription shows: quota, executions used, percent of quota used, period start and end, time left, and whether the quota resets at renewal.
- Two figures side by side: percent of quota used, and percent of the period gone.
- Color is on percent of quota used only. Green through 70. Then a continuous shift through yellow and orange to red at 100. Above 100 stays red. Percent of the period gone is a plain number.
- The usage-over-time chart stays.
- Instance actions, license actions, license requests, roles, and contact stay, on their own screens, off the subscription view.
- The subscription shows "N instances reporting."
- The instance drill-down is a plain list: name, license, executions, reporting status. No actions on that list.
- Do not invent policies, instance caps, or friendly instance names. If a subscription has no policy in the data, leave that line out.

### Model

- Account: the customer that owns the licenses and subscriptions.
- Subscription: the purchased commercial terms, including plan, quotas and dates. Belongs to an Account. Defines which licenses each quota covers. The source strikes the synonym Purchase.
- License key: the License Server identifier that connects licensed usage to a Subscription and Account.
- Instance: an identifiable n8n instance. Activation records when a license key is used on an instance. Instances can be production or non-production (test, staging).
- Usage: reported consumption linked to an Instance and attributed to a Subscription and Account for the period being reported.

### Access

- Someone at the customer (often IT) sets up the subscription, then delegates portal access to other people. Those people may be IT admins or billing.
- A Users screen: one table of people with access. Columns: name, email, role, and which subscriptions they can access.
- Role is read or write.
- Scope is all subscriptions, or only selected subscriptions.
- Each row has a three-dot menu. Include remove. Do not invent a long action list.
- A primary Invite button at the top opens a dialog to invite a person and assign role and scope.
- A pending-invites list, with a way to manage those invites (cancel is enough to name).
- Keep this on the Users screen, off the subscription view.

### Principle

- The portal is mostly informational. Information is passive.
- Only a few actions exist.
- The action we want customers to take is to talk to n8n, specifically their CSM (customer success manager).

### Contact

- Entry points to contact the CSM.
- A CTA when quota is high or over quota: contact your CSM.
- A CTA when renewal needs attention: contact your CSM.
- These sit on the subscription view, next to the situation that triggered them.
- Contact stays a real screen too, but the entry points are the point.

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
    - Users: active admins + pending invites
      - Invite or remove an admin
    - Contact n8n: assigned CSM + contact action

## Open

- How a subscription relates to instances, and whether a subscription limits how many. Not decided. Do not invent an answer in the UI.
- This "mostly informational" rule is the bias against adding further actions.
- Only production instances are billed. Non-production instances exist and are not billed. Believed, not verified.

## Log

- 2026-10-26: plan opened from the design discussion. Not executed.
- 2026-10-26: locked the Users screen. Read or write, scoped to purchases. Not executed.
- 2026-10-26: locked the informational bias and CSM entry points on the purchase view. Not executed.
- 2026-10-26: locked granularity. Quota on the purchase. Usage rolls up from instances. Not executed.
- 2026-10-26: locked the five-entity model. Entity name is Subscription. Screen label still open. Not executed.
- 2026-10-26: tree adopted from the design-brief flowchart. Not executed.
- 2026-10-26: executed the happy path. Overview, Subscriptions with subscription and license drill-downs, Instances with instance details, Users with read/write and scope, Contact n8n with CSM entry points. Quota is high above 70%; renewal needs attention within 60 days.
