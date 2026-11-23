# Lisette project instructions

## Read only what the task needs
- Implementation: `docs/superpowers/plans/2026-10-17-lisette-delivery.md` (rules, task list), then the task's module plan.
- Behaviour: the relevant sections of `docs/product/requirements.md` (its sharing and manuscript-protection policies apply everywhere) and the screen's entry in `docs/product/screens.md`.
- Database: the relevant section of `docs/superpowers/specs/2026-10-21-lisette-database-design.md`. Tables, columns, types, allowed values and limits come only from it and `lisette-schema.html`; plans never redefine them. Record schema changes in both. In the HTML, edit only the affected card and the changelog; do not read it whole.
- Interface copy: `brand/brand.yaml` and `brand/voice.md`. Visual work: also `brand/identity.md` and `docs/design/README.md` (visual reference only). The other brand guides are for brand, marketing or naming work only.

## Constraints
- Preserve exact approved taglines and the Romanian central promise, with diacritics. Drafts, research, personas and reference artwork are not approved facts or production assets; do not promote them without the user's decision.
- Do not reopen settled brand decisions or treat a candidate feature list as a finalized MVP. Flag a material conflict with an approved decision briefly, then follow the user's latest explicit instruction.
- Do not claim planned features, publisher partnerships, security guarantees or outcomes already exist. Verifying an upload or device credential is not proof of authorship.
- When an approved decision changes, update its canonical reference and affected guides together and keep `brand/brand.yaml` consistent. Functional decisions go in `docs/product/requirements.md`; brand identity stays in `brand/`.
- Expo / React Native work: use the `expo` plugin skills, starting with `expo:expo-overview`. Write tests first (`superpowers:test-driven-development`). Native-only modules use an EAS development build, never a local Android SDK.
