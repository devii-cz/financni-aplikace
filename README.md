# Finanční aplikace

Responzivní webová PWA pro sledování osobních příjmů a výdajů. Projekt je napsaný v **HTML, CSS a vanilla JavaScriptu** – bez frameworku.

## Odkaz na web v produkci
https://b2024biskda.delta-www.cz

## Funkce

- Rychlé přidání transakce (výdaj / příjem, kategorie, více měn)
- Přehled zůstatku, příjmů a výdajů
- Historie s úpravou a mazáním
- Statistiky podle kategorií (filtr období, graf na Canvas)
- Světlý / tmavý režim
- Offline drafty v `localStorage` + synchronizace po připojení
- Instalace jako PWA na plochu telefonu

## Dokumentace

| Soubor | Obsah |
|--------|-------|
| [navrh-projektu.md](./navrh-projektu.md) | Schválené zadání projektu |
| [DOKUMENTACE.md](./DOKUMENTACE.md) | Technická dokumentace (struktura, API, princip fungování) |

## Spuštění

```bash
npm install
```

Vytvořte `web/config.js` podle vzoru:

```js
// web/config.js
window.FINANCE_API_KEY = 'vas-api-klic';
```

```bash
npm start
```

Otevřete **http://localhost:3000**

> Soubor `web/config.js` je v `.gitignore` – API klíč se necommituje.

## Struktura

Hlavní zdrojové kódy jsou ve složce **`web/`**:

```
web/
├── index.html
├── style.css
├── script.js      # logika aplikace
├── api.js         # Fetch API klient
├── sw.js          # Service Worker
└── manifest.json  # PWA
```

## Technologie

HTML5 · CSS3 · JavaScript (ES moduly) · Fetch API · localStorage · PWA
