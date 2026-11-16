<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the root PortalShell and React context for shared navigation and prototype persona state; this keeps one synthetic account consistent across screens without persistent storage or app authentication.
- Keep browser-safe synthetic fixtures and reporting selectors in lib modules, and reuse presentation components across Overview and Subscriptions; this preserves consistent contract-period and completeness semantics without a backend.
- Give every portal screen its own TanStack file route and metadata, with instance drill-down filters in validated URL search parameters; this supports real navigation and shareable read-only views.
- Licenses (user decision — do not revert): sidebar order is Overview, Subscriptions, Instances, Users. Do not show a Licenses sidebar item or any in-app link to `/licenses`. Keep the `/licenses` route and AllLicensesList so the cross-purchase list can return later. Do not show a Licenses tab on the Enterprise subscription page. Do not render Request licenses or other create/request-license buttons. Do not render Create instance; keep `CreateInstance` so it can return later. New-mode Overview is a quiet count line of subscriptions and instances, then the subscription quota rows with the over-quota subscription first. Do not put the three totals, a plan-end tile, or a license-key list back on New-mode Overview. Old-mode Overview keeps subscription, renewal date, then instances, with the primary license ID as subtext under the subscription name. In New mode, license keys live on the subscription they belong to, with Issued to and the instances tied to those keys, and with no licenses-page link.
- Subscriptions (user decision — do not revert): each account has one subscription. The Subscriptions sidebar item opens the subscriptions list. A single subscription page shows a left-arrow Back to Subscriptions link above the title, linking to that list, and does not use a purchase-list breadcrumb trail. Keep `SubscriptionList` and show it when no subscription is selected.
- Contact actions create only local drafts without addresses or delivery; the contact destination fallback remains an unresolved product decision.

- Management is a session-only prototype in portal-management: no provisioning, paid orders, invitation delivery, authentication, or persistence. Preserve reported execution history when an instance leaves the inventory, and enforce proposed role permissions in the shared state transition function.

- All action buttons use the shared UI Button primitive, whose solid/outline/ghost styles follow the current n8n Storybook pill-button contract. Do not introduce page-specific button colors or shapes; retain 14px minimum text and readable destructive actions.
