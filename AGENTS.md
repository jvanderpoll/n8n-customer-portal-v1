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
- Licenses (user decision — do not revert): sidebar order is Overview, Enterprise, Instances, Users. Do not show a Licenses sidebar item or any in-app link to `/licenses`. Keep the `/licenses` route and AllLicensesList so the cross-purchase list can return later. Do not show a Licenses tab on the Enterprise subscription page. Do not render Request licenses or other create/request-license buttons. Do not render Create instance; keep `CreateInstance` so it can return later. Overview shows the subscription name (Enterprise on the main account) and the primary license ID, with no licenses-page link.
- Subscriptions (user decision — do not revert): each account has one subscription. The Enterprise sidebar item opens that subscription directly, with no purchase list and no breadcrumb. Keep `SubscriptionList` for a later return; use it only when the account has no subscription.
- Contact actions create only local drafts without addresses or delivery; the contact destination fallback remains an unresolved product decision.

- Management is a session-only prototype in portal-management: no provisioning, paid orders, invitation delivery, authentication, or persistence. Preserve reported execution history when an instance leaves the inventory, and enforce proposed role permissions in the shared state transition function.

- All action buttons use the shared UI Button primitive, whose solid/outline/ghost styles follow the current n8n Storybook pill-button contract. Do not introduce page-specific button colors or shapes; retain 14px minimum text and readable destructive actions.
