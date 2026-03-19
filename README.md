# 🎬 Cinematic Shuffle

Un'app per scoprire il tuo prossimo film da vedere, con filtri avanzati e tracking dei film già visti.

---

## Stack tecnologico

- **React 18** + **TypeScript** — UI e logica
- **Vite** — build tool ultra-rapido
- **Tailwind CSS** — styling utility-first
- **TMDB API** — database di film (gratuita)
- **LocalStorage** — persistenza film visti e shuffle history
- **Framer Motion** — animazioni

---

## Guida completa: dal repo al deploy

### PARTE 1 — Ottenere l'API key TMDB

L'app usa le API di **The Movie Database (TMDB)**, gratuite per uso personale.

1. Vai su [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup) e crea un account gratuito
2. Verifica la tua email
3. Vai su [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
4. Clicca **"Create"** → scegli **"Developer"**
5. Compila il form (puoi mettere "Uso personale" come descrizione)
6. Copia la tua **API Key (v3 auth)** — sarà una stringa alfanumerica

---

### PARTE 2 — Setup locale del progetto

#### 2.1 Prerequisiti

Assicurati di avere installato:
- **Node.js** versione 18 o superiore → [nodejs.org](https://nodejs.org)
- **Git** → [git-scm.com](https://git-scm.com)

Verifica con:
```bash
node --version   # deve mostrare v18.x.x o superiore
git --version    # deve mostrare git version x.x.x
```

#### 2.2 Clona o crea il progetto

Se stai partendo da zero con questi file:
```bash
# Crea una cartella e spostati dentro
mkdir cinematic-shuffle
cd cinematic-shuffle
```

Se hai già i file (scaricati o copiati):
```bash
cd cinematic-shuffle
```

#### 2.3 Installa le dipendenze

```bash
npm install
```

#### 2.4 Configura le variabili d'ambiente

```bash
# Rinomina il file di esempio
cp .env.example .env
```

Apri `.env` con il tuo editor e sostituisci `la_tua_api_key_qui` con la key ottenuta da TMDB:

```env
VITE_TMDB_API_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

> ⚠️ **IMPORTANTE**: non committare mai il file `.env` su GitHub! È già nel `.gitignore`.
> Se dimentichi la key, l'app ti mostrerà una schermata per inserirla direttamente nel browser.

#### 2.5 Avvia in modalità sviluppo

```bash
npm run dev
```

L'app sarà disponibile su [http://localhost:5173](http://localhost:5173)

---

### PARTE 3 — Creare il repository su GitHub

#### 3.1 Crea un nuovo repo su GitHub

1. Vai su [github.com/new](https://github.com/new)
2. **Repository name**: `cinematic-shuffle`
3. **Description**: "App per scoprire film casuali con filtri avanzati"
4. **Visibility**: Public (necessario per Netlify free tier) o Private
5. **NON** aggiungere README, .gitignore o license (li abbiamo già)
6. Clicca **"Create repository"**

#### 3.2 Inizializza Git e fai il primo push

```bash
# Dalla cartella del progetto
git init
git add .
git commit -m "feat: initial commit - Cinematic Shuffle app"

# Collega al tuo repository GitHub (sostituisci USERNAME con il tuo username)
git remote add origin https://github.com/USERNAME/cinematic-shuffle.git
git branch -M main
git push -u origin main
```

#### 3.3 Verifica che il .env NON sia stato committato

```bash
git status
```

Il file `.env` **non deve apparire** nell'output — grazie al `.gitignore` è già escluso.

---

### PARTE 4 — Deploy su Netlify

#### 4.1 Crea un account Netlify

Vai su [netlify.com](https://netlify.com) e accedi con GitHub (più comodo per il collegamento automatico).

#### 4.2 Collega il repository

1. Nella dashboard Netlify, clicca **"Add new site"** → **"Import an existing project"**
2. Scegli **"Deploy with GitHub"**
3. Autorizza Netlify ad accedere ai tuoi repository
4. Cerca e seleziona `cinematic-shuffle`

#### 4.3 Configura le build settings

Netlify dovrebbe rilevare automaticamente Vite, ma verifica che i campi siano:

| Campo | Valore |
|-------|--------|
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Node version** | `18` (o superiore) |

Grazie al file `netlify.toml` già incluso nel progetto, queste impostazioni sono automatiche.

#### 4.4 Configura la variabile d'ambiente su Netlify

> ⚠️ **CRITICO**: il file `.env` non va mai su GitHub, quindi devi configurare la variabile direttamente su Netlify.

1. Vai su **Site configuration** → **Environment variables**
2. Clicca **"Add a variable"**
3. Inserisci:
   - **Key**: `VITE_TMDB_API_KEY`
   - **Value**: la tua API key TMDB (es. `a1b2c3d4e5f6...`)
4. Clicca **"Save"**

#### 4.5 Fai il deploy

1. Torna su **Deploys**
2. Clicca **"Trigger deploy"** → **"Deploy site"**
3. Aspetta 1-2 minuti che la build termini
4. Il tuo sito è live! L'URL sarà tipo `https://amazing-name-123456.netlify.app`

#### 4.6 (Opzionale) Imposta un dominio personalizzato

In **Domain management** → **Add custom domain** puoi collegare il tuo dominio.

---

### PARTE 5 — Workflow di sviluppo continuo

#### Push aggiornamenti

Da questo momento, ogni volta che fai push su GitHub, Netlify fa il deploy automaticamente:

```bash
# Modifica i file...
git add .
git commit -m "feat: aggiunta nuova funzionalità"
git push
```

Il deploy su Netlify parte automaticamente in pochi secondi.

#### Branch di preview

Netlify crea automaticamente URL di preview per ogni branch/PR:

```bash
git checkout -b feature/nuova-feature
# ... modifica ...
git push origin feature/nuova-feature
```

Netlify genererà un URL di preview separato per testare prima del merge.

---

## Struttura del progetto

```
cinematic-shuffle/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ApiKeySetup.tsx    # Schermata di setup API key
│   │   ├── FilterPanel.tsx    # Pannello filtri (genere, anno, attori, ecc.)
│   │   ├── MovieCard.tsx      # Scheda completa del film
│   │   ├── SearchView.tsx     # Vista ricerca film
│   │   ├── ShuffleView.tsx    # Vista principale shuffle
│   │   └── WatchedView.tsx    # Lista film visti
│   ├── hooks/
│   │   ├── useShuffle.ts      # Hook per la logica shuffle
│   │   └── useWatched.ts      # Hook per gestione film visti
│   ├── services/
│   │   └── tmdb.ts            # Tutte le chiamate API TMDB + algoritmo shuffle
│   ├── store/
│   │   └── watched.ts         # CRUD localStorage per film visti
│   ├── types/
│   │   └── index.ts           # Tutti i tipi TypeScript + costanti
│   ├── utils/
│   │   └── index.ts           # Funzioni di utilità (formatRuntime, cn, ecc.)
│   ├── App.tsx                # Root component + navigazione
│   ├── index.css              # Stili globali + Tailwind
│   ├── main.tsx               # Entry point React
│   └── vite-env.d.ts          # Tipi variabili ambiente Vite
├── .env                       # ← NON committare! (è nel .gitignore)
├── .env.example               # Template per la configurazione
├── .gitignore
├── index.html
├── netlify.toml               # Config deploy Netlify
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Funzionalità

### 🎲 Shuffle
- Premi **SHUFFLE** per ricevere un film casuale
- Algoritmo anti-ripetizione: tiene traccia degli ultimi 50 film estratti con penalizzazione dei 10 più recenti
- Ogni estrazione campiona pagine casuali dal database TMDB per massima varietà

### 🎛️ Filtri disponibili
| Filtro | Descrizione |
|--------|-------------|
| **Già visto** | Tutti / Solo non visti / Solo già visti |
| **Decade** | Anni '50, '60, '70, '80, '90, 2000, 2010, 2020 |
| **Anno specifico** | Qualsiasi anno dal 1900 ad oggi |
| **Genere** | 19 generi disponibili (azione, horror, commedia...) |
| **Voto minimo** | Da 0 a 9, step 0.5 |
| **Attori** | Ricerca full-text con autocomplete e foto |
| **Regista** | Ricerca per nome |

### 🔍 Ricerca
- Cerca qualsiasi film per titolo con autocomplete
- Visualizza la scheda completa e aggiungilo ai film visti

### 👁️ Film visti
- Lista persistente salvata nel browser (localStorage)
- Filtro per titolo
- Aggiunta da Shuffle, Ricerca, o scheda film
- Rimozione con un click

### 🃏 Scheda film include
- Poster + backdrop
- Titolo, titolo originale, tagline
- Voto TMDB con colore (verde/oro/grigio)
- Anno di uscita
- Durata (formattata in h/min)
- Generi
- Regista
- Cast completo con foto e personaggio interpretato
- Trama in italiano

---

## Comandi disponibili

```bash
npm run dev      # Avvia il server di sviluppo (localhost:5173)
npm run build    # Build per produzione (output in /dist)
npm run preview  # Preview della build di produzione
```

---

## Note tecniche

### API key senza .env
Se non vuoi usare il file `.env` (es. sviluppo rapido), puoi inserire la key direttamente nella schermata di setup che appare al primo avvio. Viene salvata nel localStorage del browser.

### Limiti API TMDB
- TMDB limita i risultati discover a 500 (50 pagine da 20 risultati)
- Il filtro per regista richiede una chiamata extra per risolvere il nome in ID
- Le immagini sono servite da `image.tmdb.org` (CDN globale, molto veloce)

### Algoritmo shuffle anti-ripetizione
1. Recupera il numero totale di pagine disponibili per i filtri
2. Genera un array di tutte le pagine e lo mescola con Fisher-Yates
3. Per ogni pagina campionata, esclude i film nella history recente (ultimi 10)
4. Se non trova candidati validi dopo 5 pagine, usa qualsiasi film disponibile
5. Ogni film estratto viene aggiunto alla history (max 50 elementi)

---

## Troubleshooting

**"API key TMDB mancante"**
→ Crea il file `.env` con `VITE_TMDB_API_KEY=la_tua_key` e riavvia il server

**"Nessun film trovato con i filtri selezionati"**
→ I filtri sono troppo restrittivi. Prova a togliere qualche filtro, specialmente la combinazione anno + genere + voto

**Il deploy su Netlify fallisce**
→ Verifica che `VITE_TMDB_API_KEY` sia configurata nelle Environment Variables di Netlify

**Le immagini non caricano**
→ Verifica la connessione a `image.tmdb.org` (potrebbe essere bloccato da alcuni firewall aziendali)

---

## Configurazione Firebase (login Google + sync multi-device)

Firebase è **opzionale** — senza di esso l'app funziona con localStorage. Con Firebase ottieni:
- Login con Google in un click
- Film visti sincronizzati su tutti i dispositivi
- Rating personali persistenti nel cloud
- Migrazione automatica dei dati già salvati nel browser

### PARTE A — Creare il progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Clicca **"Aggiungi progetto"**
3. Nome: `cinematic-shuffle` (o quello che vuoi)
4. Disabilita Google Analytics (non serve)
5. Clicca **"Crea progetto"**

### PARTE B — Aggiungere una Web App

1. Nella console Firebase, clicca l'icona **`</>`** (Web)
2. Nickname app: `cinematic-shuffle-web`
3. **Non** spuntare Firebase Hosting (usiamo Netlify)
4. Clicca **"Registra app"**
5. Copia il blocco `firebaseConfig` — ti servono questi valori:

```js
const firebaseConfig = {
  apiKey: "...",           // → VITE_FIREBASE_API_KEY
  authDomain: "...",       // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "...",        // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "...",    // → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...",// → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "..."             // → VITE_FIREBASE_APP_ID
};
```

### PARTE C — Abilitare Google Authentication

1. Nel menu laterale vai su **Authentication** → **Sign-in method**
2. Clicca **Google** → Abilita il toggle
3. Inserisci un'email di supporto (la tua)
4. Clicca **Salva**

### PARTE D — Creare il database Firestore

1. Nel menu laterale vai su **Firestore Database**
2. Clicca **"Crea database"**
3. Scegli **"Avvia in modalità produzione"**
4. Scegli la region più vicina (es. `europe-west1` per l'Italia)
5. Clicca **Avanti** → **Crea**

#### Configurare le Security Rules

Vai su **Firestore Database** → **Regole** e incolla queste rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Ogni utente può leggere e scrivere solo i propri dati
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Clicca **"Pubblica"**. Queste regole garantiscono che ogni utente acceda solo ai propri film.

### PARTE E — Aggiungere il dominio Netlify agli autorizzati

Dopo il deploy su Netlify, dovrai autorizzare il dominio per il login Google:

1. In Firebase Console → **Authentication** → **Settings** → **Domini autorizzati**
2. Clicca **"Aggiungi dominio"**
3. Inserisci il tuo URL Netlify (es. `amazing-name-123456.netlify.app`)
4. Se hai un dominio custom, aggiungilo anch'esso

### PARTE F — Configurare le variabili su Netlify

In Netlify → **Site configuration** → **Environment variables**, aggiungi:

| Key | Valore |
|-----|--------|
| `VITE_TMDB_API_KEY` | la tua key TMDB |
| `VITE_FIREBASE_API_KEY` | dall'oggetto firebaseConfig |
| `VITE_FIREBASE_AUTH_DOMAIN` | dall'oggetto firebaseConfig |
| `VITE_FIREBASE_PROJECT_ID` | dall'oggetto firebaseConfig |
| `VITE_FIREBASE_STORAGE_BUCKET` | dall'oggetto firebaseConfig |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | dall'oggetto firebaseConfig |
| `VITE_FIREBASE_APP_ID` | dall'oggetto firebaseConfig |

Poi fai **Trigger deploy** → la build ripartirà con le nuove variabili.

### PARTE G — Configurare in locale

Aggiorna il tuo file `.env`:

```env
VITE_TMDB_API_KEY=la_tua_key_tmdb

VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=cinematic-shuffle-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cinematic-shuffle-xxx
VITE_FIREBASE_STORAGE_BUCKET=cinematic-shuffle-xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

Riavvia `npm run dev` e vedrai il pulsante "Accedi con Google" nell'header.

---

## Come funziona la migrazione localStorage → Firestore

Al primo login, l'app rileva automaticamente i film già salvati nel browser e li trasferisce su Firestore:

1. L'utente fa login con Google
2. L'app controlla se esiste una lista nel localStorage e se non è già stata migrata
3. Se ci sono film, li scrive tutti su Firestore in batch (efficiente e atomico)
4. Un toast di conferma mostra quanti film sono stati migrati
5. Il flag `cinematic_ls_migrated_{uid}` nel localStorage impedisce migrazioni duplicate

---

## Struttura Firestore

```
users/
  {uid}/
    watched/
      {movieId}/
        id: number
        title: string
        poster_path: string | null
        release_date: string
        vote_average: number        ← voto TMDB
        personal_rating: number | null  ← voto personale 1-5 stelle
        addedAt: Timestamp
```
