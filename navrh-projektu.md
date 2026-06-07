# Zadání projektu – Finanční aplikace

> Zadání závěrečného projektu.  
> Technická dokumentace: [DOKUMENTACE.md](./DOKUMENTACE.md)

## 1. Název a cíl projektu

**Název:** Finanční aplikace – sledování osobních výdajů a příjmů

**Cíl:** Vytvořit responzivní webovou aplikaci v čistém JavaScriptu pro rychlé zaznamenávání transakcí, přehled o zůstatku a vizualizaci výdajů podle kategorií. Aplikace bude fungovat jako **PWA** (instalace na plochu telefonu) a splní požadavky zadání:

- dynamická úprava obsahu v JavaScriptu,
- lokální úložiště (`localStorage`),
- komunikace s REST API (Fetch API),
- progresivní webová aplikace.

## 2. Use-case (praktické využití)

**Scénář:** Uživatel zaplatí v obchodě nebo restauraci a chce si výdaj ihned zapsat.

1. Otevře aplikaci z ikony na ploše mobilu (PWA).
2. V rychlém formuláři zadá název (např. „Oběd“), částku (např. `150` v Kč nebo `6` v EUR), typ (výdaj/příjem) a kategorii (např. Jídlo).
3. JavaScript data ověří. Pokud je částka v cizí měně, pošle požadavek na REST API a získá ekvivalent v Kč.
4. Transakce se odešle na REST API (Fetch API).
5. Aplikace bez obnovení stránky přepočítá zůstatek, přehled a statistiky.

**Offline scénář:** Pokud není internet, transakce se dočasně uloží do `localStorage`. Po obnovení připojení je JavaScript automaticky odešle na REST API.

**Use-case diagram:**

```
Uživatel zadá transakci
        ↓
JavaScript ověří vstup a stav připojení
        ↓
Online?  → ANO → Fetch API (POST /api/transactions)
        → NE  → localStorage (draft) → po online syncDrafts()
        ↓
JavaScript dynamicky překreslí zůstatek, historii a graf
```

## 3. Návrh designu

- **Mobilní first:** aplikace je primárně určena pro telefon (rychlé zadávání výdajů).
- **Záložky:** Přehled (zůstatek + rychlé přidání), Přidat, Statistiky, Historie.
- **Světlý / tmavý režim** s přepínačem v menu.
- **Výběr měny zobrazení** (Kč, EUR, USD, …) – pro statistiky se pracuje s ekvivalentem v Kč.
- **Responzivní layout:** CSS proměnné, flexbox/grid, bezpečné okraje pro výřezy displeje (`safe-area-inset`).
- **PWA:** standalone režim, ikony, theme color, service worker pro cache statických souborů.

## 4. Technologie

| Oblast | Technologie |
|--------|-------------|
| Struktura a obsah | HTML5 |
| Vzhled | CSS3 (proměnné, dark mode, responzivita) |
| Logika | vanilla JavaScript (ES moduly) |
| Komunikace se serverem | Fetch API |
| Lokální úložiště | `localStorage` |
| PWA | `manifest.json`, Service Worker (`sw.js`) |

## 5. Struktura projektu

Hlavní projekt tvoří soubory webové aplikace ve složce `web/`:

```
web/
├── index.html          # UI – formuláře, záložky, modály
├── style.css           # Vzhled a responzivita
├── script.js           # Hlavní logika (validace, render, offline)
├── api.js              # Fetch volání na REST API
├── sw.js               # Service Worker
├── manifest.json       # PWA konfigurace
├── config.example.js   # Vzor konfigurace API klíče
├── favicon.svg         # Ikona v prohlížeči
├── apple-touch-icon.png
├── icon-192.png
└── icon-512.png
```

Soubor `config.js` (API klíč) se vytvoří lokálně podle vzoru a do repozitáře se necommituje.

## 6. Lokální úložiště (localStorage)

Aplikace ukládá data lokálně pomocí `localStorage`:

| Klíč | Účel |
|------|------|
| `theme` | Světlý / tmavý režim |
| `displayCurrency` | Vybraná měna zobrazení |
| `activeTab` | Poslední otevřená záložka |
| `currencyRates` | Cache kurzů pro offline zobrazení |
| `transactionDrafts` | Transakce čekající na odeslání (offline) |

## 7. REST API

Aplikace komunikuje s REST API pomocí **Fetch API** (`api.js`). Požadavky obsahují hlavičku `X-API-Key` a tělo ve formátu JSON.

**Datový model transakce** (co aplikace odesílá a přijímá):

| Pole | Typ | Popis |
|------|-----|-------|
| `id` | string (UUID) | Jednoznačný identifikátor |
| `name` | string | Název položky (např. „Oběd“) |
| `type` | `"income"` \| `"expense"` | Typ transakce |
| `amount` | number (kladné) | Částka v Kč |
| `category` | string | Kategorie (Jídlo, Mzda, …) |
| `createdAt` | string (ISO 8601) | Datum a čas vytvoření |

**Endpointy, které aplikace využívá:**

| Metoda | Cesta | Popis |
|--------|-------|-------|
| `GET` | `/api/transactions` | Načtení všech transakcí |
| `POST` | `/api/transactions` | Vytvoření transakce |
| `PATCH` | `/api/transactions/:id` | Úprava transakce |
| `DELETE` | `/api/transactions/:id` | Smazání transakce |
| `GET` | `/api/rates` | Aktuální kurzy pro přepočet zobrazení |
| `GET` | `/api/convert?amount=&from=&to=` | Převod částky do Kč před uložením |

**Příklad těla POST:**

```json
{
  "name": "Oběd",
  "type": "expense",
  "amount": 150,
  "category": "Jídlo"
}
```

Při zadání cizí měny aplikace nejdřív zavolá `/api/convert`, výsledek v Kč uloží přes `/api/transactions`.

## 8. PWA

- **`manifest.json`** – název, ikony, barvy, `display: standalone`.
- **`sw.js`** – cachuje statické soubory (HTML, CSS, JS, ikony); API požadavky neinterceptuje.
- Umožňuje instalaci na homescreen a částečnou funkčnost offline (UI + drafty).

## 9. Dynamická úprava obsahu (JavaScript)

Obsah stránky se mění bez reloadu:

- načtení transakcí z API → generování položek seznamu,
- odeslání formuláře → aktualizace zůstatku a grafu,
- přepnutí měny / tématu / záložky → okamžitá změna DOM,
- statistiky – filtr období a kreslení grafu na HTML Canvas.

## 10. Možnosti dalšího rozšíření

- Export transakcí do CSV nebo PDF.
- Měsíční limity výdajů podle kategorií s upozorněním.
- Vlastní kategorie definované uživatelem.
- Push notifikace v rámci PWA.
- Přihlášení a synchronizace mezi více zařízeními.
