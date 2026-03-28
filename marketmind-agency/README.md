# MarketMind Agency 🚀

Vollständige KI-Marketingagentur als Single-Page-App  
**GitHub Pages** Hosting · **Firebase** Backend · **Groq** Text-KI · **OpenRouter** Bildgenerierung

---

## 🚀 Schnell-Deployment (15 Minuten)

### 1. Firebase Projekt erstellen

1. Gehe zu **[console.firebase.google.com](https://console.firebase.google.com)**
2. Klicke **„Projekt hinzufügen"** → Name: `marketmind-agency` → Erstellen
3. Im Projekt: **Authentication** → Erste Schritte → **E-Mail/Passwort** aktivieren
4. **Firestore Database** → Erstellen → **Produktionsmodus** → Region: `europe-west6` (Zürich)
5. **Projekteinstellungen** (⚙️) → **Deine Apps** → Web-App (`</>`) → App registrieren
6. Kopiere die `firebaseConfig` Werte

### 2. Firebase Config eintragen

Öffne `js/firebase.js` und ersetze:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",        // aus Firebase Console
  authDomain:        "mein-projekt.firebaseapp.com",
  projectId:         "mein-projekt",
  storageBucket:     "mein-projekt.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

### 3. Firestore Security Rules setzen

Firebase Console → Firestore → **Regeln** → Folgendes einfügen:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Jeder User sieht nur seine eigenen Daten
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /{subcollection}/{document} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

→ **Veröffentlichen**

### 4. GitHub Repository erstellen

```bash
# Neues Repository auf github.com erstellen: "marketmind-agency"
# Dann lokal:

git init
git add .
git commit -m "Initial commit - MarketMind Agency"
git remote add origin https://github.com/DEIN-USERNAME/marketmind-agency.git
git push -u origin main
```

### 5. GitHub Pages aktivieren

1. GitHub Repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` → Folder: `/ (root)` → **Save**
4. Nach 1-2 Minuten läuft die App unter:  
   `https://DEIN-USERNAME.github.io/marketmind-agency/`

---

## 🔑 API Keys (beim ersten Start)

API Keys werden **nur in deinem Browser (localStorage)** gespeichert — nie in Firebase.

| Key | Woher | Kosten |
|-----|-------|--------|
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | Kostenlos |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Kostenlos (Bilder) |

---

## 📁 Dateistruktur

```
marketmind-agency/
├── index.html          ← Hauptapp (komplettes UI)
├── js/
│   ├── firebase.js     ← Firebase Init + Auth + DB Operationen
│   ├── api.js          ← Groq + OpenRouter API Calls
│   └── app.js          ← Gesamte App-Logik + State
└── README.md
```

---

## 🗄️ Datenstruktur in Firestore

```
users/
  {userId}/
    (Profil, Brand-Kit, Stats)
    clients/         → CRM Kunden
    campaigns/       → Kampagnen
    saved/           → Gespeicherte Texte
    feedbacks/       → KI-Lernschleife
    team/            → Freelancer
    tasks/           → Aufgaben
    schedule/        → Social Planer
```

---

## ⚙️ Lokale Entwicklung

```bash
# Mit VS Code Live Server Extension
# Oder Python:
python3 -m http.server 8080
# → http://localhost:8080
```

---

## 🔒 Sicherheit

- ✅ Jeder User sieht **nur seine eigenen Daten** (Firestore Rules)
- ✅ API Keys nie in der Datenbank — nur localStorage
- ✅ Firebase Auth mit E-Mail/Passwort
- ✅ HTTPS via GitHub Pages

---

## 📱 Als PWA / App nutzen

In Chrome: Adressleiste → **„Zum Startbildschirm hinzufügen"**  
→ Verhält sich wie eine native App

---

## 🛠️ Customizing

- **Farben**: CSS-Variablen in `index.html` → `:root { --a: #c8f135; ... }`
- **Logo/Name**: `index.html` → `.bnm` Element
- **Groq Modell**: `js/api.js` → `GROQ_MOD` Variable
- **Bild-Modell**: `js/api.js` → Default Parameter in `callORImage()`
