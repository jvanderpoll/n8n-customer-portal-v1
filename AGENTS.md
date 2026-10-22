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
- Contact actions create only local drafts without addresses or delivery; the contact destination fallback remains an unresolved product decision.
