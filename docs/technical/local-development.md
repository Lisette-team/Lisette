# Dezvoltare locală

Pașii de pornire a aplicației Lisette pe calculator și pe telefon, plus testele și backend-ul Supabase local.

## Versiuni

| Unealtă | Versiune | Observații |
|---|---|---|
| Node.js | 24 LTS (`>=24.3 <25`) | Fixată în `.nvmrc` și în `engines` din `package.json`. |
| npm | 11 | Folosim `package-lock.json`. Nu folosim yarn sau pnpm. |
| Expo SDK | 58 (`expo ~58.0.19`) | React Native 0.88.0, React 19.3.0, Expo Router ~58.0.26. |
| Expo Go | pentru SDK 58 | Versiunea curentă din Play Store și App Store. |
| Supabase CLI | 2.121.0 | Instalat ca devDependency; se rulează cu `npx supabase`. |
| Docker Desktop | orice versiune recentă | Necesar pentru Supabase local (`supabase start`, `supabase test db`). |
| Playwright | ^1.64 | Testele web; browserul se instalează cu `npx playwright install chromium`. |

**De ce SDK 58.** Un Expo Go rulează un singur SDK. Proiectul a pornit pe 57, pentru că la 21 octombrie 2026 magazinele aveau Expo Go 57. Pe 24 octombrie 2026 Expo Go din magazine trecuse la 58, așa că proiectul a fost actualizat la 58. Pe iPhone nu se poate instala un Expo Go mai vechi; pe Android, un Expo Go pentru un SDK anterior se instalează ca APK de pe https://expo.dev/go.

## Prima pornire

```bash
git clone <repo> && cd Lisette
node -v            # trebuie să fie 24.x
npm ci             # instalează exact versiunile din package-lock.json
cp .env.example .env.local
npx expo start
```

- **Web:** apasă `w` în terminal sau deschide `http://localhost:8081`.
- **Android:** instalează Expo Go din Play Store, apoi scanează codul QR din terminal cu Expo Go.
- **iPhone (doar pentru testare):** instalează Expo Go din App Store, apoi scanează codul QR cu aplicația Camera. Planul de livrare țintește Android și web, nu iOS.

Telefonul și calculatorul trebuie să fie în aceeași rețea Wi-Fi. La prima pornire, Windows poate întreba dacă Node.js are acces la rețea: alege **Allow** pentru rețele private. Dacă telefonul tot nu se conectează, rulează `npx expo start --tunnel`.

Dacă Expo Go afișează „Project is incompatible with this version of Expo Go”, versiunea SDK a proiectului nu se potrivește cu Expo Go de pe telefon. Verifică tabelul de mai sus.

Fără Supabase pornit, ecranele de limbă, creare cont și autentificare se deschid, dar trimiterea formularelor afișează o eroare.

## Supabase local

Cere Docker Desktop pornit.

```bash
npx supabase start         # pornește Postgres, Auth, Storage și Mailpit local
npx supabase status        # afișează URL-ul API, anon key și service_role key
npx supabase db reset      # reconstruiește baza din supabase/migrations
npx supabase test db       # rulează testele SQL din supabase/tests
npx supabase stop
```

Din `npx supabase status`, copiază în `.env.local`:

- `EXPO_PUBLIC_SUPABASE_URL` și `EXPO_PUBLIC_SUPABASE_ANON_KEY` pentru aplicație;
- `SUPABASE_SERVICE_ROLE_KEY` doar pentru testele locale.

Cheia `service_role` nu primește niciodată prefixul `EXPO_PUBLIC_`, nu intră în cod și nu se comite. `.env.local` e ignorat de git.

Pe telefon, `127.0.0.1` înseamnă telefonul, nu calculatorul. Pentru Expo Go, pune în `EXPO_PUBLIC_SUPABASE_URL` adresa calculatorului din rețea, de exemplu `http://192.168.1.160:54321`.

**Emailuri.** Local, emailurile de confirmare și de resetare a parolei nu pleacă în exterior. Le vezi în Mailpit, la `http://127.0.0.1:54324`. Durata linkului de confirmare și lungimea minimă a parolei se setează în `supabase/config.toml`. Aplicația afișează deocamdată 24 de ore și 10 caractere; valorile nu sunt încă decise și trebuie să coincidă cu configurația.

**Migrări.** Baza de date (`supabase/config.toml`, migrările și testele SQL) vine din branchul `task/01-database`; detaliile sunt în `docs/technical/01-database-local-development.md`. Schema se schimbă numai prin migrări, iar `npx supabase db reset` trebuie să reconstruiască totul din ele, fără modificări manuale în bază.

**Utilizatori de test.** `tests/helpers/local-users.ts` creează conturi deja confirmate prin API-ul de administrare. Refuză să ruleze pe alt server decât `127.0.0.1` sau `localhost`.

## Comenzi npm

| Comandă | Ce face |
|---|---|
| `npm start` | Pornește serverul de dezvoltare (Metro). |
| `npm run android` / `npm run ios` / `npm run web` | Pornește serverul și deschide platforma respectivă. |
| `npm test -- --runInBand` | Testele de componente (Jest, `tests/**/*.test.tsx`). |
| `npm run test:web` | Testele web Playwright (`tests/e2e`); pornesc singure serverul pe portul 8099. |
| `npm run typecheck` | Verificarea TypeScript (`tsc --noEmit`). |
| `npm run lint` | ESLint, cu configurația Expo (`expo lint`). |

Testul web care intră într-un cont real se sare automat dacă `SUPABASE_SERVICE_ROLE_KEY` nu e setat. Pentru el, pornește Supabase local și exportă variabilele din `.env.local` înainte de `npm run test:web`.

După o schimbare de dependențe sau de SDK, rulează `npx expo start --clear` ca să golești cache-ul Metro.

## Reguli pentru dependențe

- Instalează pachetele cu `npx expo install <pachet>`, nu cu `npm install`, ca versiunile să rămână compatibile cu SDK-ul.
- Verifică proiectul cu `npx expo install --check` și `npx expo-doctor`.
- Nu adăuga module care nu funcționează în Expo Go cât timp testăm cu Expo Go.
- `@testing-library/react-native` e pe 14.x, cerută de Expo Router 58, cu `test-renderer` în loc de `react-test-renderer`. Din versiunea 14, `render`, `renderRouter`, `fireEvent` și `unmount` sunt asincrone: în teste se scriu cu `await`.

## Structură

- `src/app/`: doar rutele Expo Router. `(auth)` conține ecranele pentru utilizatori neautentificați, iar `(app)` zona privată.
- `src/features/account/session.ts`: sesiunea, limba aleasă și acțiunile de cont.
- `src/lib/`: clientul Supabase și stocarea pe dispozitiv.
- `src/ui/`: tema (culorile și fonturile aprobate) și câteva controale comune.
- `src/i18n/`: textele RO/EN și configurarea i18next.
- `supabase/`: configurația locală, migrările și testele SQL, din branchul `task/01-database`.
- `tests/`: testele de componente, testele web (`tests/e2e`) și utilitarele de test.
- `assets/brand/lisette-mark.png`: semnul Lisette decupat din grafica aprobată. E provizoriu până apar fișierele vectoriale de producție.
