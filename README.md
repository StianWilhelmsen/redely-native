# Redely – App (Expo / React Native)

Mobilappen til Redely: oppgaver, utlegg, handleliste og chat for kollektiv og delte husstander.
Live på App Store: <https://apps.apple.com/no/app/id6794833285>.

> Appen het tidligere «Ryddig Kollektiv». Det gamle navnet lever videre i bundle id
> (`com.wilhelmsen.ryddigkollektiv`), URL-scheme (`ryddigkollektivnative`) og backend-URL-en,
> og kan ikke enkelt endres.

## Stack

- **Expo SDK 54**, React Native 0.81, React 19, TypeScript
- **expo-router** (filbasert routing, typed routes, React Compiler på)
- **SWR** for datahenting mot Spring Boot-backenden ([`../ryddig-kollektiv-backend`](../ryddig-kollektiv-backend))
- **STOMP over WebSocket** (`@stomp/stompjs`) for sanntidsoppdateringer i kollektivet
- **Supabase Auth** (e-post/passord, Sign in with Apple)
- **RevenueCat** (`react-native-purchases`) for abonnement – abonnementet gjelder per kollektiv
- **expo-notifications** for push

## Kom i gang

1. Installer avhengigheter:

   ```bash
   npm install
   ```

2. Kopier `.env.example` til `.env` og fyll inn verdier (se [Miljøvariabler](#miljøvariabler)).

3. Start dev-serveren:

   ```bash
   npx expo start
   ```

Appen bruker native moduler (RevenueCat, Apple-innlogging, push m.m.) og krever derfor en
**development build** (`expo-dev-client`) – Expo Go holder ikke.

## Miljøvariabler

Leses i [`src/lib/env.ts`](src/lib/env.ts). Mangler en påkrevd verdi, krasjer appen med en tydelig feilmelding.

| Variabel | Påkrevd | Merknad |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | ja | Supabase-prosjektets URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ja | Anon/public-nøkkel (trygg å bygge inn i klienten) |
| `EXPO_PUBLIC_API_URL` | nei i dev | Uten denne utledes `http://<metro-host>:8080` automatisk, som fungerer for fysisk enhet på samme nett. Android-emulator: `http://10.0.2.2:8080` |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | nei | Uten den virker alt unntatt selve kjøpet |

For EAS-bygg settes alle verdiene i [`eas.json`](eas.json) (peker mot prod-backenden på Render).

## Prosjektstruktur

```
src/
  app/          Skjermer (expo-router). (app)/ er tab-navigasjonen:
                hjem, kollektiv, handleliste, chat, meg
  components/   UI-komponenter, gruppert per område (home, chat, shopping,
                subscription, weekly-summary, ...)
  contexts/     AuthContext
  hooks/        use-me, use-unread, tema-hooks
  lib/          API-klient, Supabase, WebSocket, kjøp, push, dato- og domenelogikk
  constants/    Tema, abonnementsplaner, juridiske tekster
```

## Sjekker

```bash
npx tsc --noEmit   # typesjekk
npx expo lint      # lint
npm test           # Jest (src/lib/__tests__)
```

Etter at du har lagt til en ny route: kjør `npx expo start` en kort stund så typed routes
regenereres – ellers avviser `tsc` den nye href-en.

## Bygg og release

Bygges med [EAS](https://docs.expo.dev/build/introduction/). Profiler i `eas.json`:

- `development` – dev client, intern distribusjon
- `preview` – intern distribusjon
- `production` – App Store, build-nummeret autoinkrementeres (`appVersionSource: remote`)

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

EAS-kvoten er begrenset – samle endringer og bygg bare når det faktisk trengs.

**Lockfile:** `npm ci` på EAS feiler med «Missing ... from lock file» hvis `package-lock.json`
er generert med en annen npm-versjon. Regenerer den fra scratch med npm 10.8.2:

```bash
rm package-lock.json
npx npm@10.8.2 install
```

Versjonsnummeret (`version`) settes i [`app.json`](app.json).
