# Local development

The backend runs locally with the Supabase CLI in Docker. Nothing here touches the hosted project.

## Setup (once per computer)

- Docker, with your user in the `docker` group: `sudo usermod -aG docker $USER`, then log out and back in. Check with `docker info`.
- Supabase CLI, installed globally (not as a project dependency). Use the same version on both computers:

  ```bash
  curl -fsSL https://github.com/supabase/cli/releases/download/v2.121.0/supabase_linux_amd64.tar.gz \
    | sudo tar -xz -C /usr/local/bin supabase
  supabase --version
  ```

## Daily commands

| Command | What it does |
|---|---|
| `supabase start` | Starts Postgres, Auth, Storage, Studio and Mailpit. Prints the local URLs and keys. |
| `supabase stop` | Stops the stack and keeps the data. |
| `supabase status` | Prints the URLs and keys again. |
| `supabase db reset` | Drops the local database and rebuilds it from `supabase/migrations/` (then `supabase/seed.sql`, if present). Run it before every merge. |
| `supabase test db` | Runs the pgTAP tests in `supabase/tests/database/` against the local database. |
| `supabase migration new <topic>` | Creates a timestamped migration file. Never rename or number migrations by hand. |

Local URLs: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Mailpit `http://127.0.0.1:54324`.

The keys `supabase start` prints are local defaults, safe for development only. Never use the secret or service-role key in the app or in `EXPO_PUBLIC_*` variables.

Changes to `supabase/config.toml` apply only after `supabase stop` and `supabase start`; `db reset` does not reload them.

## Auth

- Email + password, with email verification on (`enable_confirmations = true`). Locally, verification and password-recovery emails are not sent; open them in Mailpit.
- Sign-up must send user metadata. A database trigger creates the `accounts` and `profiles` rows from it:

  ```ts
  supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: 'Ana Popescu', locale: 'ro' } },
  });
  ```

  | Key | Value |
  |---|---|
  | `display_name` | Required. The person's name (1–80 characters) or the publication's name (1–120). |
  | `locale` | `ro` or `en`; defaults to `ro`. |
  | `account_kind` | `person` (default) or `publisher`. Read once at sign-up; it never changes later. |
  | `publisher_kind` | Required when `account_kind` is `publisher`: `publishing_house`, `literary_magazine` or `independent_editor`. |

  Missing or invalid values make sign-up fail with "Database error saving new user", so the form must validate them first. A person's private contact email starts as the sign-up email. A publisher starts with `approval_status = pending`.
- After sign-in, read the account with `rpc('get_session_context')`: `{accountId, kind, locale, authorEnabled, approvalStatus}` (`authorEnabled` is null for publishers, `approvalStatus` null for persons). Change the language with `rpc('set_locale', { locale: 'en' })`.

## Database functions the app calls

| Call | Who | Result |
|---|---|---|
| `rpc('activate_author')` | person | Turns on the author profile; same account ID. |
| `rpc('set_block', { target_id, blocked })` | anyone signed in | Blocks or unblocks another account. |
| `rpc('is_blocked_with', { other })` | anyone signed in | Whether the caller and `other` are blocked either way. Use it in RLS policies too; `is_blocked(a, b)` is internal. |
| `rpc('create_work', { title, description?, language?, genre_id? })` | author | Creates a private work owned by the caller and returns its ID. |
| `rpc('export_my_data')` | anyone signed in | JSON with the caller's own rows only. |
| `rpc('request_account_deletion')` | anyone signed in | Queues the request and signs out every session. Nothing is deleted. The current access token keeps working until it expires (1 hour), so the app should sign out locally right after. |
| `rpc('approve_publisher', { publisher_id, method })`, `rpc('reject_publisher', { publisher_id })` | admin | Decide a pending publisher. |

`publishers` hides `reviewed_by`, so `select('*')` on it fails with "permission denied". List the columns: `from('publishers').select('id, kind, name, intro, logo_path, website, approval_status')`. Once a publisher is approved or rejected, it can no longer change its `name` or `kind`.

## Admins

Admins are person accounts listed in `public.admins`. The app can never add one. Locally, sign up as a person, then run in the Studio SQL editor:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
```

## SQL tests

Tests are pgTAP files named `<acceptance_name>.test.sql`. Each one runs inside a transaction and rolls back. To act as a user, insert a row into `auth.users` (the trigger creates the account), then switch role:

```sql
set local role authenticated;
set local request.jwt.claims to '{"sub": "<user id>", "role": "authenticated"}';
```

Use `reset role;` to go back to the superuser, and `set local role anon;` to test signed-out access.

## Fixtures

Tests create their own users and roll back, so they need no fixtures. Shared demo data for the app goes in `supabase/seed.sql` (not created yet); `db reset` loads it after the migrations.

## Edge Functions

None exist yet. Create one with `supabase functions new <name>`; `supabase start` serves every function at `http://127.0.0.1:54321/functions/v1/<name>`. Run `supabase functions serve` instead when you want live reload and logs.
