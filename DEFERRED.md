# Checki — Deferred Features

Things discussed and intentionally postponed. Review before each planning sprint.

---

## Localization
- [ ] Georgian UI (`ka`)
- [ ] Russian UI (`ru`)
- [ ] Currently: English-only; all product names normalized to English
- [ ] When ready: locale switcher per venue or per user

## Product Catalog
- [ ] **Product recipes / bill of materials** — cocktail = gin 50ml + campari 25ml + vermouth 25ml
  - Needed for procurement; not for the check display (cocktail stays one line item)
  - Implement alongside Procurement module
- [ ] **Duplicate merging** — AI normalization flags near-duplicates, manager merges manually
  - E.g. "Heineken 0.5" vs "Heineken" — same product or different?
- [ ] **Normalization review queue** — manager sees AI-suggested changes before they apply
  - For now: auto-apply with high confidence; low-confidence → stays as-is

## Procurement / Inventory
- [ ] Procurement module: weekly order planning based on product usage from archive
- [ ] Stock levels per product (current qty, par level, reorder point)
- [ ] Supplier catalog (name, contact, lead time)
- [ ] Purchase orders: create → send → receive → update stock
- [ ] Blocked by: product recipes (need to know ingredients before tracking stock)

## Subscription & Billing
- [ ] Subscription plans per venue (free / pro / enterprise)
- [ ] Billing history and invoices
- [ ] Payment method management (card on file)
- [ ] Venue self-service upgrade/downgrade

## Superadmin Panel
- [ ] Web UI for creating venues and assigning first manager
  - Currently: done via bootstrap script / direct DB
- [ ] Venue list with status, subscription, usage stats
- [ ] Ability to impersonate / support access

## Branding & UI
- [ ] Logo instead of venue name text in top bar
- [ ] Dark/light theme toggle
- [ ] PWA / installable on home screen (manifest + service worker)

## Tech / Infrastructure
- [ ] Automated DB migrations on deploy (currently: manual `psql` on server)
- [ ] Soft-delete for checks (currently: status-based only)
- [ ] Audit log for staff actions (who closed what check, at what time)
- [ ] Rate limiting on auth endpoints
- [ ] Email/SMS notifications (e.g. daily revenue report to manager)
