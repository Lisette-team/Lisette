# Test accounts (local only)

`supabase/seed.sql` creates these accounts. `supabase db reset` loads it, so they come back after every reset. They exist only in the local stack. Never load the seed into a hosted database (see `01-database-local-development.md`).

Password for every account: `parola_test`

| Role | Email | Name | What it can do |
|---|---|---|---|
| Normal user (reader) | `cititor@lisette.local` | Mihai Dobre | Person account, author profile off. Feed, library, reactions. |
| Writer | `scriitor@lisette.local` | Ana Popescu | Person account, author profile on, phone `+40712345678` already set, so it can create works, upload manuscripts and submit. |
| Publication | `editura@lisette.local` | Editura Pagina Albă | Approved publishing house with two open calls. |

The seed has two more approved publications for testing the other kinds: `revista@lisette.local` (literary magazine, one closed call and one draft) and `editor@lisette.local` (independent editor, one open call). Same password.

The writer starts with no works or manuscripts: upload them in the app.
