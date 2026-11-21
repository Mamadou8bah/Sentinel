# Platform administration

The operator manages Sentinel's tenant access, not individual identity decisions.
Platform accounts live outside tenant staff tables and use a separate sign-in at
`/platform/login` without a tenant selector. Tenant staff cannot grant platform
access. Platform credentials never imply a tenant staff identity.

Use the existing Manrope type, semantic surface/line/content tokens, neutral
light/dark desk palette and single accent. Reuse PageHeader, Panel, Field and
DataTable. Desktop gets a narrow navigation rail; mobile gets a wrapping header
and scrollable navigation. Forms have one primary action, clear pending/error
states and a reason for privileged changes. Tenant operations live on a separate
detail page with General, Staff and API keys sections rather than one large form.

Overview shows real platform totals, Tenants is a searchable paginated directory,
Audit is append-only operator history, and Security changes the operator password.
Suspension requires the exact tenant code. Keys and callback secrets are shown
once and never stored in browser session state or audit details. Revocation and
password reset invalidate access; the last enabled tenant admin cannot be removed.
Platform login sessions use sessionStorage, expire with the server JWT, have no
automatic replay of writes, and remain separate from staff/demo sessions.

The marketing landing and tenant decision pages remain unchanged. Verify the new
pages at 390 and 1440 pixels in both themes, and test tenant/platform authorization
boundaries independently of screenshots.
