# Fantasy Word - Game Design Document v3

---

## Executive Summary

FantasyWiki is a full-stack web application inspired by fantasy soccer, where players **instantly purchase words with a virtual budget**, accumulate points based on Wikipedia search volume, and **compete with other player in private and global leagues**.
### Target Audience

The gameplay combines:
- **Tactical strategy** (word selection + portfolio balancing)
- **Budget management** (limited budget, time urgency)
- **Weekly competition** (all players in 1 common tournament)
- **Tangible rewards** (bonus points in main game, not cosmetics)
- **Elite prestige** (Monthly Power Tournament, anti-AFK)

**Audience**: Casual-core players who love fantasy soccer, trading card games, and social competition. Age range: 18-45 years.
## Glossary (Ubiquitous language)
- *User*: Person that visit the website
- *Account*: 
- *Player*: Is a user that is authenticated inside the system
- *Article*: an entity representing a unique Wikipedia Article, (excluding disambiguation, redirect, stub as explained [here](https://en.wikipedia.org/wiki/Wikipedia:What_is_an_article%3F)) 
- *Language*: language of the wikipedia article
- *Contract*: Time bounded possession of an article by a Team
- *Team*: Is an aggregate of multiple contract owned by a single player in certain League
- *League*: Is an aggregate of multiple Team with one language.
  - *Public/Private League*: League can be created by players and can be public or private. players can join private leagues only by invitation by the league admin. Public leagues doesn't require invitation to be joined.
  - *League Admin*: Player that created the league. 
- *Credit*: It's the game currency used by teams to buy and sell articles
- *Point*: It's a value representing the performance of an article in a fixed time span, linked to the pageviews ([definition](https://en.wikipedia.org/wiki/Pageview))

## User stories

### User Onboarding
When a user visits the website and it's not already authenticated, he sees the introduction page, explaining the rules and a call to action for performing the login.

### User Login
When a user press the login button can perform a login with google account, if the authentication is successful it get redirected to his personal dashboard containing his info. He also get added to the Public League.

### Player can see his dashboard
When a player enter the dashboard page, he's able to see the leagues he has joined and he's also able to create or join new leagues

### Player can create a League
When a player enter the creation league page, he can create a league specifying:
- Name of the League
- Language of the League (dropdown menu, single choice)
- Duration of the League (months/weeks from the time of creation)

If the creation is successful the player is notified and get added to the league. He also receive a code and a invitation link to share with other players that want to join.

### Player can join private league from the site
When entering the join league page, Player can enter private league submitting the invitation code. If the code is present the player join the corresponding league and it his redirected to the team creation page.

### User can't visit any page other than login and onboarding if not authenticated
When a User try to visit a page of our website when is not authenticated it is redirected to the login page. Exception are made for the onboarding and login page.

### Player can join private league by invitation code
When a player visit the invitation link, it join the league and it is redirected to the team creation page


### User can buy some article

---

## 1. Word Acquisition System (MODIFIED in v2.0)

### 1.1 Radical Change: From Asynchronous Draft → Instant Purchase

**v1.0 (OLD)**: Complex initial auction (7 days), Draft from randomly extracted word pool. Very high friction.

**v2.0+ (NEW)**: User enters and **buys IMMEDIATELY** without waiting for friends or schedule.

```
COMPLETE USER FLOW:

1. Signup → Initial budget: 1,000 Credits
2. Quick tutorial: Search "Bitcoin"
3. See price: 150 Credits (dynamic, based on trending)
4. Click: [BUY]
5. ✅ DONE - Bitcoin in portfolio
6. Expiration: 7 days from now

VISUAL PORTFOLIO:
┌─────────────────────────────┐
│ Bitcoin      [150 Cr]  ⏱️ 3d │ (expires in 3 days)
│ AI           [120 Cr]  ⏱️ 1d │
│ Crypto       [80 Cr]   ⏱️ 5d │
│ Cloud        [100 Cr]  ⏱️ 7d │
├─ Remaining Budget: 550 Cr  │
├─ Portfolio Value: 450 Cr   │
├─ Main Game Rank: #4,523    │
└─ Tournament Rank: #512     │ (Weekly)
```

#### Motivation

**v1.0 Problem**: Complex draft → 7 days of waiting → very high friction for new players.

**v2.0+ Solution**:
- ✅ **Immediate CTA**: First click → buy word in 10 seconds
- ✅ **No Coordination**: Player vs market only
- ✅ **Continuous FOMO**: Expiration creates daily urgency
- ✅ **Psychological Loop**: Buy → Monitor → Decision point → Renew/Sell

### 1.2 Contracts (Time-Limited Securities with Expiration)

Each word purchased is a **contract with expiration**. They are not perpetual securities.

```
BITCOIN CONTRACT:
├─ Purchase Date: Dec 15, 2025, 14:30 UTC
├─ Purchase Price: 150 Credits
├─ Expiration: Dec 22, 2025, 14:30 UTC (+7 days)
├─ Volume Views Yesterday: 15,000
├─ Points Accumulated Today: 15 points
├─ Current ROI: +8%
├─ ROI Projection: +25% (at expiration)
│
├─ POSSIBLE ACTIONS:
│ ├─ HOLD: Keep until expiration
│ ├─ SELL NOW: Sell today, receive credits
│ ├─ RENEW: Renew +7 days (fixed cost 10 Cr)
│ └─ SWAP: Replace with another word
│
└─ Status: ACTIVE ✅
```

#### Duration Tiers

| Tier | Duration | Initial Cost | Renewal |
|------|--------|---|---|
| **SHORT** | 3 days | 50-80 Cr | +5 Cr |
| **MEDIUM** | 7 days | 100-200 Cr | +10 Cr |
| **LONG** | 14 days | 200-350 Cr | +15 Cr |
| **SEASON** | 90 days | 800-1200 Cr | N/A |

**Default**: Medium (7 days).

#### Dynamic Pricing

```
BASE_COST = Average_Views_30Days / 500

Trend Multiplier:
  If Views_last_7d > Views_previous_7d × 1.20:
    COST × 1.15 (upturn boost)
  Else if Views < previous × 0.80:
    COST × 0.85 (downturn discount)
  Else: COST × 1.0

Rarity Multiplier:
  If Average_Views_30Days < 1000:
    COST × 0.70 (rare word discount)

Duration Multiplier:
  SHORT (3d):    BASE_COST × 0.60
  MEDIUM (7d):   BASE_COST × 1.00
  LONG (14d):    BASE_COST × 1.70
  SEASON (90d):  BASE_COST × 4.50
```

#### Motivation

**v1.0 Problem**: Unlimited securities → no urgency → low engagement.

**v2.0+ Solution**:
- ✅ **Time Urgency**: Contract expires, player decides every 3-14 days
- ✅ **Psychological Loop**: Buy → Monitor → Decision point
- ✅ **Dynamic Portfolio**: Not stagnant, constantly evolves
- ✅ **Risk/Reward**: "Renew? Sell? Let it expire?"

### 1.3 Word Catalog and Search

**Available Pool:**
- All Wikipedia pages in the league language
- Exclusions: Disambiguations, redirects, stubs
- Inclusions: Any article with >50 views/day

**Search UI:**

```
┌─────────────────────────────────────────┐
│ 🔍 RICERCA PAROLA                       │
│                                         │
│ Scrivi qui:                             │
│ ┌──────────────────────────────────────┐│
│ │ Bitcoin____                          ││
│ └──────────────────────────────────────┘│
│                                         │
│ SUGGERIMENTI:                           │
│ • Bitcoin                 Vol: 12,000   │
│ • Bitcoin Cash            Vol: 800      │
│ • Cryptocurrency          Vol: 5,000    │
│ • Satoshi Nakamoto        Vol: 300      │
│                                         │
│ [COMPRA BITCOIN (150 Cr)]              │
│                                         │
└─────────────────────────────────────────┘
```

**Limiti di Acquisto:**
- Max 1 contratto per parola (no duplicati)
- Max 10 contratti attivi contemporaneamente
- Min budget: 10 Crediti

### 1.4 Transazioni di Mercato

#### Acquisto Diretto (Istantaneo)

```
FLUSSO:
1. Ricerca parola
2. Vedi prezzo + trend
3. Seleziona durata (SHORT/MEDIUM/LONG/SEASON)
4. Clicca [COMPRA]
5. Contratto istantaneo, crediti detratti
```

#### Vendita Anticipata

```
FLUSSO:
1. Seleziona contratto dal portafoglio
2. Clicca [VENDI ORA]
3. Sistema calcola prezzo attuale (trend-based)
4. Ricevi crediti

PREZZO VENDITA:
├─ Trend up: Prezzo × 1.05-1.20
├─ Trend flat: Prezzo × 1.00
├─ Trend down: Prezzo × 0.80-0.95
└─ Floor: Min 50% di acquisto (no loss guarantee)
```

#### Rinnovo Contratto

```
FLUSSO:
1. Contratto con <24h prima scadenza
2. Notifica: "Bitcoin scade. Rinnova?"
3. Clicca [RINNOVA] → +7 giorni extra
4. Costo: 10 Cr fisso (independente da prezzo)
```

#### Scambi Diretti (Player-to-Player)

```
MECCANICA:
1. Proponi scambio a giocatore specifico
2. "Do Bitcoin, voglio AI"
3. Riceve notifica, accetta/rifiuta
4. Se accetta: scambio immediato

REGOLE:
├─ Max 1 scambio per giocatore per settimana
├─ Entrambi devono avere slot disponibili
├─ 1:1 contratti (no crediti)
└─ Non scadenza oggi
```

#### Prestiti Brevi (Boost Temporaneo)

```
MECCANICA:
1. Proponi: "Ti presto Bitcoin 3 giorni, dai 50 Cr"
2. Accetta/rifiuta
3. Bitcoin entra in portfolio ricevitore
4. Ricevitore guadagna punti, prestatore crediti
5. Auto-return dopo 3 giorni

REGOLE:
├─ Max 3 giorni durata
├─ Max 2 prestiti attivi per ricevitore
└─ Credito vincolato al prestito
```

---

## 2. Sistema di Mercato (COMPLETAMENTE NUOVO)

### 2.1 Timing: Da 12 Giorni → Continuo 24/7

**v1.0 (VECCHIO)**: Cicli fissi di 12 giorni, mercato aperto 3 giorni.

**v2.0+ (NUOVO)**: **Mercato SEMPRE APERTO** (24/7).

```
TIMELINE v2.0+:

Giorno 1: Compra Bitcoin + Ethereum (7d scadenza)
Giorno 2: Portfolio in leaderboard, guadagna punti
Giorno 3: Vende Bitcoin, riceve crediti
Giorno 4: Compra AI + Quantum
Giorno 5: Rinnova Ethereum (+7d)
Giorno 7: Bitcoin scade, rimosso
Giorno 8: Compra nuova parola

SCORING: Ogni 24 ore (no cicli fissi)
```

#### Motivazione

**v1.0 Problem**: Mercato chiuso 9 giorni → basso engagement.

**v2.0+ Solution**:
- ✅ **Engagement Continuo**: Ritorno OGNI GIORNO
- ✅ **Flessibilità**: Reazione immediata a trending
- ✅ **No Friction**: Niente "finestre chiuse"
- ✅ **Urgenza Quotidiana**: Contratti scadono, giocatore decide

---

## 3. Sistema di Scoring Composito (IDENTICO a v1.0)

**Nessun cambiamento rispetto a v1.0.** La formula di scoring rimane esattamente la stessa.

### 3.1 Struttura del Punteggio

```
PUNTEGGIO_FINALE = (PUNTEGGIO_BASE × MOLTIPLICATORE_INTESA) + BONUS_BREAKOUT + MALUS_FLOP + BONUS_EVENTO
```

Componenti:
1. **Punteggio Base** (obbligatorio)
2. **Moltiplicatore Intesa** (applicato al base)
3. **Bonus Breakout** (additivo)
4. **Malus Flop** (additivo)
5. **Bonus Evento** (additivo, solo se attivo)

### 3.2 Punteggio Base

```
PUNTEGGIO_BASE = Views_24Ore / 2000
```

Dove:
- `Views_24Ore` = pageviews giornaliere su Wikipedia
- Divisore 2000: scala per 0-50 punti/giorno

**Esempi:**
- 20k views/24h → 10 punti
- 40k views/24h → 20 punti
- 5k views/24h → 2.5 punti

### 3.3 Moltiplicatore Intesa (Jaccard-based)

#### Calcolo Similarità

```
Jaccard(A, B) = |Links_A ∩ Links_B| / |Links_A ∪ Links_B|
```

Dove:
- `Links_A` = link in uscita dalla pagina A
- `Links_B` = link in uscita dalla pagina B

#### Colori FIFA (5 Livelli)

| Jaccard Score | Colore | Bonus |
|---|---|---|
| ≥ 0.50 | 🟢 VERDE | +20% |
| 0.35-0.49 | 🟡 GIALLO | +15% |
| 0.20-0.34 | 🟠 ARANCIONE | +10% |
| 0.10-0.19 | 🔵 BLU | +5% |
| < 0.10 | ⚪ GRIGIO | 0% |

**Bonus Reciprocal Link**: +5% se A → B **AND** B → A.

#### Topologie Rotanti (Settimanali)

Il portafoglio segue topologia strategica che **cambia ogni settimana**.

**1. STELLA (Settimane 1, 4, 7, ...):**
- 1 parola centrale connessa a tutte
- Parole periferiche NON connesse tra loro

**2. CATENA LINEARE (Settimane 2, 5, 8, ...):**
- Parole ordinate per views: Ord1-Ord2-Ord3-Ord4-Ord5
- Ord1 ↔ Ord2 ↔ Ord3 ↔ Ord4 ↔ Ord5

**3. TRIANGOLI + ISOLATI (Settimane 3, 6, 9, ...):**
- Cluster di 3 (tutte le coppie connesse) + 2 isolate

**Selezione**: `topologia = settimana % 3`

#### Calcolo Finale

```
MOLTIPLICATORE_INTESA = 1.0 + Σ(bonus_connessioni) / num_connessioni
```

Max: 1.20 (capped).

### 3.4 Bonus Breakout

```
If Views_24Ore > Percentile_90_30Giorni:
  BONUS_BREAKOUT = +2.5 punti
If Views_24Ore > Percentile_95_30Giorni:
  BONUS_BREAKOUT = +5 punti
Else:
  BONUS_BREAKOUT = 0
```

### 3.5 Malus Flop

```
Media_30Giorni = Σ(views_gg_ultimi_30) / 30

If Views_24Ore < Media_30Giorni × 0.40:
  MALUS_FLOP = -1.5 punti
Else:
  MALUS_FLOP = 0
```

### 3.6 Bonus Evento (Settimanale)

**Frequenza**: 1 evento per settimana (lunedì 09:00 UTC).

#### Tipi di Eventi

**Evento 1: Wikipedia Trending**
- Top 50 pagine per views ricevono +2 bonus

**Evento 2: Volatilità Esplosiva**
- Crescita > 150%: +3 bonus
- Crollo < -70%: -2 malus

**Evento 3: Low Views Protection**
- Views < 500: +1 bonus (prevent extinction)

**Evento 4: Doppio Gioco**
- Moltiplicatore intesa × 2 (max 2.40)

**Evento 5: Bonus Cluster**
- Se 3+ parole con Jaccard > 0.40: +3 bonus per cluster

#### Generazione

```
Seed: hash(user_id + week_number) mod 5
Evento = eventi_disponibili[seed]
```

---

## 4. Gameplay Tattico

### 4.1 Sistema Intesa FIFA-Style

Ogni parola riceve bonus basato su connessioni dirette nella topologia.

```
Bonus_Intesa_Parola = Σ(bonus_per_connessione)
```

### 4.2 Portafoglio Dinamico

**Max 10 contratti attivi** (no formazione fissa).

### 4.3 Daily Scoring

**Calcolato ogni 24 ore** (00:00 UTC).

```
QUANDO:
├─ Trigger: Ogni giorno 00:00 UTC
├─ Scope: Tutte le parole nel portafoglio
└─ Update automatico

COSA:
Per ogni parola:
├─ Views ultimi 24h
├─ Punteggio base
├─ Moltiplicatore intesa
├─ Breakout/Flop checks
├─ Evento bonus (se attivo)
└─ Total giornaliero
```

---

## 5. Tournament System (CORE MECHANIC - NUOVO)

### 5.1 Leaderboard Principale (Main Game)

**Aggiornamento**: Ogni ora (real-time).

```
┌──────────────────────────────────────────────────────┐
│ 🏆 MAIN GAME LEADERBOARD (Live)                     │
│ Aggiornamento: Ogni ora                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Rank | Player       | Portfolio Value | Change |    │
│ ─────┼──────────────┼─────────────────┼────────┤    │
│ 1    | CryptoGod    | €3,850          | +12%   | 📈 │
│ 2    | WordHunter   | €3,720          | +5%    | 📈 │
│ 3    | BullishBot   | €3,610          | -3%    | 📉 │
│ 4    | YOU          | €2,340          | +2%    | ➡️ │
│ ...  | ...          | ...             | ...    | ... │
│                                                      │
│ [JOIN WEEKLY TOURNAMENT] [POWER TOURNAMENT]         │
│                                                      │
└──────────────────────────────────────────────────────┘

Portfolio Value = Σ(Valore_Attuale_Contratti) + Budget_Rimanente
```

---

## 5.2 Weekly Tournament (Automatico, All Players)

**Concetto**: Ogni settimana, **TUTTI i giocatori attivi entrano automaticamente** in 1 torneo comune.

### 5.2.1 Timeline

```
LUNEDI 09:00 UTC:
├─ Nuovo Weekly Tournament inizia
├─ TUTTI i giocatori entrano AUTOMATICAMENTE (no opt-in)
├─ Portfolio snapshot dalle parole attuali (main game)
├─ Scoring identico al main game (24h, moltiplicatore intesa, etc)
│
MARTEDI-DOMENICA (6 giorni):
├─ Scoring continuo
├─ Leaderboard separata aggiornata hourly
├─ Giocatore vede: "4° in Weekly Tournament! +25 punti today"
│
DOMENICA 21:00 UTC:
├─ Torneo finisce
├─ Classifica finale calcolata
├─ Punti bonus nel MAIN GAME assegnati
├─ Badge settimanali distribuiti
│
LUNEDI 09:00 UTC:
├─ Bonus punti applicati live nel main game
├─ Nuovo Weekly Tournament inizia
└─ Ciclo ripete
```

### 5.2.2 Portfolio nel Torneo (Linked ma Separate)

```
SCENARIO:

Lunedì 09:00: Main game = [Bitcoin, AI, Cloud]
              ↓ [SNAPSHOT]
              Tournament = [Bitcoin, AI, Cloud]

Martedì 14:00 (Durante torneo):
├─ Giocatore VENDE Bitcoin (main game)
│  ├─ Main game: Bitcoin rimosso, crediti ricevuti
│  └─ Tournament: Bitcoin continua giorno per giorno
│
├─ Giocatore COMPRA Ethereum (main game)
│  ├─ Main game: Ethereum entra subito
│  └─ Tournament: Ethereum NON entra (snapshot lunedì)

Domenica 21:00:
├─ Torneo finisce: Punti calcolati con Bitcoin (7 giorni)
├─ Main game: Bitcoin già venduto, Ethereum in portfolio
├─ Punti Torneo calcolati
├─ Bonus applicati al main game

Lunedì 09:00 (Nuovo Torneo):
├─ Nuovo snapshot: [Ethereum, AI, Cloud, + altre]
└─ Nuovo torneo inizia
```

**Vantaggio**:
- ✅ Agility nel main game (compra/vendi liberamente)
- ✅ Torneo rimane stabile (no disruption)
- ✅ Giocatore strategizza: "Tengo nel torneo o vendo?"

### 5.2.3 Scoring Torneo

**Identico al main game:**

```
PUNTI TORNEO (OGNI 24 ORE):

Per ogni parola:
├─ Punteggio Base: Views_24Ore / 2000
├─ × Moltiplicatore Intesa (topologia settimanale)
├─ + Bonus Breakout
├─ + Malus Flop
└─ + Bonus Evento

TOTALE GIORNALIERO = Σ(punti per parola)

ESEMPIO - Giorno 1:
Bitcoin 7.5 + AI 4 + Cloud 1.5 + moltiplicatore 1.10 = 15.25 punti

TOTALE TORNEO (7 giorni) = Cumulative sum
```

### 5.2.4 Leaderboard Weekly Tournament

```
┌──────────────────────────────────────────────────────┐
│ 🏆 WEEKLY TOURNAMENT RANKING                         │
│ Settimana 1 / 2025-12-08 → 2025-12-15               │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Rank | Player       | Tot Points | Avg/Day | Tier  │
│ ────┼──────────────┼────────────┼────────┼──────│
│ 1    | CryptoGod    | 125.5      | 17.9   | 🥇  │
│ 2    | WordHunter   | 118.2      | 16.9   | 🥈  │
│ 3    | BullishBot   | 112.8      | 16.1   | 🥉  │
│ 4    | YOU          | 105.3      | 15.0   | Top10
│ 5    | Strategist   | 102.1      | 14.6   | Top10
│ ...  | ...          | ...        | ...    | ...  │
│ 100  | TradeQueen   | 56.2       | 8.0    | Top100
│ 1000 | NoobTrader   | 22.5       | 3.2    | Rest │
│                                                      │
│ Tu sei: 4° (105.3 punti)                           │
│ Tier: Top 10 → +20 bonus punti/giorno main game    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.2.5 Rewards Weekly Tournament (Main Game Bonus)

**Lunedì 09:00 UTC** (quando nuovo torneo inizia):

```
PUNTI BONUS SETTIMANALI (7 giorni):

├─ 🥇 Top 1:    +50 bonus punti/giorno per 7gg
├─ 🥈 Top 10:   +20 bonus punti/giorno per 7gg
├─ 🥉 Top 100:  +5 bonus punti/giorno per 7gg
├─ Top 1000:    +1 bonus punto/giorno per 7gg
└─ Resto:       +0 (partecipazione è valore)

APPLICAZIONE:
Giocatore 4° nel torneo (Top 10):
├─ Lunedì 09:00: +20 bonus punti/giorno attivati
├─ Applicati a: Tutte le parole nel portafoglio principale
├─ Durata: 7 giorni (lunedì-domenica prossimo)
├─ Visibile: "Main Game Bonus: +20 (Top 10 Weekly)"
├─ Effetto: Scoring = Normale + 20 bonus
└─ Reset: Lunedì prossimo (nuovo torneo, nuovi bonus)

ESEMPIO PRATICO:
Parola "Bitcoin" mercoledì:
├─ Views 24h: 15k → Base: 7.5 punti
├─ × Intesa 1.10 = 8.25 punti
├─ + Bonus torneo +20 punti
└─ TOTALE: 28.25 punti (vs 8.25 senza bonus)

Questo × 7 giorni della settimana
```

#### Motivazione Bonus

**Perché punti bonus e non crediti:**
- ✅ **Tangible**: Vedi il bonus in real-time
- ✅ **No Power Creep**: Punti non danno vantaggio economico
- ✅ **Viral**: "Top 10 → +20 punti/giorno!" è shareable
- ✅ **High Stakes**: Top 1 = 25x multiplier (50 punti vs 2 base)
- ✅ **Scaling**: Vinci più tornei → più bonus accumulati

---

## 5.3 Power Tournament (Elite Monthly Event)

**Concetto**: Evento esclusivo **una volta al mese** per **giocatori attivi** (anti-AFK). Requisiti di entry alti.

### 5.3.1 Requisiti di Entry (Anti-AFK)

**Per qualificarsi al Torneo del Potere (mensile):**

```
REQUISITI OBBLIGATORI:

1. Partecipazione Weekly:
   ├─ Devi partecipare a TUTTI i 4 weekly tournament del mese
   └─ Almeno 3 parole nel portfolio alla fine di ogni settimana

2. Attività Main Game:
   ├─ Min 3 transazioni (buy/sell/renew) negli ultimi 7 giorni
   └─ Portfolio attuale: Min 5 parole

3. Win Rate Minimo:
   ├─ Average punti nei weekly > 25 punti per torneo
   └─ Calcolato: Σ(punti weekly ultimi 4) / 4 > 25

4. Portfolio Strength:
   ├─ Portfolio value > 200 Cr (no farmers)
   └─ Niente reset account forzato

5. Anti-Cheat:
   ├─ Max 1 Power Tournament per account mensile
   └─ Max 1 account per IP/Device

ESEMPIO QUALIFICAZIONE:

Giocatore A:
├─ Settimana 1 weekly: 115 punti ✅
├─ Settimana 2 weekly: 95 punti ✅
├─ Settimana 3 weekly: 108 punti ✅
├─ Settimana 4 weekly: 120 punti ✅
├─ Media: (115+95+108+120)/4 = 109.5 ✅
├─ Activity: 8 transazioni ultimi 7gg ✅
├─ Portfolio: 7 parole, 350 Cr ✅
└─ QUALIFICATO ✅

Giocatore B:
├─ Settimana 1: 45 punti ❌
├─ Settimana 2: 52 punti ❌
├─ Settimana 3: 60 punti
├─ Settimana 4: 38 punti ❌
├─ Media: 48.75 punti ❌ (< 25)
└─ NON QUALIFICATO ❌
```

### 5.3.2 Timeline Power Tournament

```
1° LUNEDI DEL MESE 09:00 UTC:
├─ Sistema calcola eligibility (automated)
├─ Solo giocatori qualificati entrano
├─ Notifica: "Congratulazioni! Eligible per Torneo del Potere"
├─ Parole dal main game entrano (snapshot)
│
LUNEDI-DOMENICA (7 giorni):
├─ Scoring identico al main game
├─ Leaderboard SEPARATA (elite only)
├─ Max 50-100 qualificati per mese
├─ Hype massima
│
DOMENICA 21:00 UTC:
├─ Torneo finisce
├─ Classifica finale (elite ranking)
├─ Rewards calcolati (MASSIMI)
├─ 👑 Badge permanente assegnato
│
LUNEDI PROSSIMO 09:00 UTC:
├─ Bonus punti applicati nel main game (30 giorni!)
├─ Nuovo Weekly Tournament inizia
├─ Nuovo ciclo Power eligibility check (per mese prossimo)
└─ 👑 Badge rimane nel profilo FOREVER
```

### 5.3.3 Leaderboard Power Tournament

```
┌──────────────────────────────────────────────────────┐
│ 🏆👑 POWER TOURNAMENT RANKING (Elite Only)           │
│ Dicembre 2025 / 1° Mese                              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Rank | Player       | Tot Points | Avg/Day | Crown │
│ ────┼──────────────┼────────────┼────────┼──────│
│ 1    | CryptoGod    | 156.8      | 22.4   | 👑   │
│ 2    | BullishBot   | 148.3      | 21.2   | 👑   │
│ 3    | WordHunter   | 142.9      | 20.4   | 👑   │
│ ...  | ...          | ...        | ...    | ...  │
│ 25   | TopPlayer25  | 98.5       | 14.1   | 👑   │
│ 26   | Elite26      | 95.2       | 13.6   | ⭐   │
│ ...  | ...          | ...        | ...    | ...  │
│ 100  | Finalist100  | 72.1       | 10.3   | ⭐   │
│                                                      │
│ ONLY 50-100 Qualified Players Per Month             │
│ (Top 25 get 👑 Crown, 26-100 get ⭐)               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.3.4 Rewards Power Tournament (Massimi)

**Lunedì dopo Power Tournament finito:**

```
BONUS PUNTI MONTHLY (30 giorni):

👑 Top 1:    +100 bonus punti/giorno per 30gg (GAME-CHANGING)
👑 Top 10:   +50 bonus punti/giorno per 30gg
👑 Top 25:   +25 bonus punti/giorno per 30gg
⭐ Top 50:   +10 bonus punti/giorno per 30gg
⭐ 51-100:   +5 bonus punti/giorno per 30gg

EFFETTO MASSIMO (Top 1):
+100 bonus/giorno × 30 giorni = 3000 punti bonus in main game!

ESEMPIO:
Giocatore Top 1 (100 bonus/giorno per 30gg):
├─ Bitcoin: 7.5 base + 100 bonus = 107.5 punti/giorno
├─ AI: 4 base + 100 bonus = 104 punti/giorno
├─ Cloud: 1.5 base + 100 bonus = 101.5 punti/giorno
│
└─ Totale giorno: 313 punti
   (vs 12.25 senza bonus = 25.5x MULTIPLIER!)

Per 30 giorni:
└─ 313 × 30 = 9.390 punti totali (MASSIVE)

Main Game Leaderboard:
├─ 1° senza bonus: 5.000 punti
├─ Power Top 1: 5.000 + 9.390 = 14.390 punti
└─ Posizione: Vola in classifica
```

#### Visualizzazione del Bonus

```
PROFILO UTENTE:

┌─────────────────────────────┐
│ 👑 POWER CHAMPION            │
│ (Dicembre 2025)              │
│                              │
│ Active Bonus:                │
│ +100 punti/giorno            │
│ ⏱️ 15 giorni rimasti         │
│                              │
│ Ranking Profile:             │
│ 1° POWER (Dec)               │
│ Top 10 WEEKLY (Week 1,2,3,4) │
│                              │
│ Badge Showcase:              │
│ 👑 Power Champion (Dec)      │
│ ⭐ Elite Top 25 (Nov)        │
│ 🥇 Champion (Weekly)         │
│                              │
└─────────────────────────────┘

MAIN GAME LEADERBOARD:

Tu (con Power Bonus): €14,390
├─ Base portfolio: €5,000
├─ + Power Bonus: +€9,390
└─ Badge 👑 visibile accanto nome
```

---

## 5.4 Badge System

### Weekly Badges (7 giorni)

```
PER SETTIMANA (Reset lunedì):

├─ 🥇 Champion: Top 1
├─ 🥈 Runner-Up: Top 2-3
├─ 🥉 Finalist: Top 4-10
├─ 📈 Best Gainer: Max crescita lunedì-domenica
├─ ⚡ Volatile: Max cambio ranking durante settimana
└─ 🔥 Streak: Top 10 per 3+ settimane consecutive

Rimangono visibili 7 giorni, poi archiviate nel profilo (achievement wall)
```

### Power Tournament Badges (Permanenti)

```
PER MESE (Permanente nel profilo):

👑 Power Champion: Top 1 (Massimo prestige)
👑 Elite Top 10: Top 2-10
👑 Elite Top 25: Top 11-25
⭐ Power Finalist: Top 26-100
🏅 Repeat Power: Qualified 3+ mesi consecutivi

VISUALIZZAZIONE:
├─ Profilo mostra timeline: "Power Champion (Dec) → Elite Top 10 (Jan) → Power Champion (Feb)"
├─ Conteggi: "3x Power Champion"
└─ Bio: "3x Champion, 2x Elite Top 10"
```

---

## 6. Timeline Completa (Frequenza Temporale)

### Daily

```
00:00 UTC: Calcolo scoring main game + tournament
09:00 UTC: Leaderboard aggiorna (main + weekly separate)
12:00 UTC: Notifiche scadenze contratti
20:00 UTC: Push notifications trending parole
```

### Weekly (Lunedì)

```
09:00 UTC:
├─ Nuovo Weekly Tournament inizia (auto-entry)
├─ Precedente torneo finisce:
│  ├─ Classifica finale calcolata
│  ├─ Bonus punti assegnati (+50 top1, +20 top10, etc)
│  ├─ Badge settimanali distribuiti
│  └─ Power eligibility controllata
├─ Topologia rotante (new week)
├─ Evento settimanale generato
└─ Bonus precedente applicato nel main game

Domenica 21:00:
├─ Weekly Tournament finisce
├─ Scoring cumulativo di 7 giorni
└─ Attesa risultati lunedì 09:00
```

### Monthly (1° Lunedì Mese)

```
09:00 UTC:
├─ Eligibility check (automated)
├─ Power Tournament inizia (qualified players only)
├─ Leaderboard ELITE (50-100 giocatori)
├─ Durata: 7 giorni

Domenica 21:00:
├─ Power Tournament finisce
└─ Bonus massimi calcolati

Lunedì prossimo 09:00:
├─ Bonus applicato nel main game (+100 top1 per 30gg!)
├─ 👑 Badge assegnato (permanente)
└─ Nuovo mese, nuovo ciclo
```

---

## 7. Database Schema

### Core Entities

**Users:**
- user_id, username, email, language
- budget_totale, budget_disponibile
- leaderboard_rank, leaderboard_score
- tournament_stats {weekly_bests, power_participations}
- active_bonuses [{bonus_per_day, end_date, source}]
- badges_earned [{badge_type, date, week_or_month}]

**MainGamePortfolio:**
- portfolio_id, user_id, last_updated
- contracts [{contract_id, word_name, price, expiration}]

**TournamentInstances:**
- tournament_id, type (WEEKLY/POWER)
- week_number, month_year, status
- start_date, end_date
- eligible_players [user_ids]

**TournamentParticipations:**
- participation_id, user_id, tournament_id
- portfolio_snapshot [{word_name, price_acquired}]
- daily_scores [7 giorni]
- final_ranking, bonus_earned

**TournamentScores:**
- score_id, user_id, tournament_id, day_number
- score_components {base, intesa, breakout, flop, evento}
- daily_total

**TournamentBonuses:**
- bonus_id, user_id, tournament_id
- bonus_per_day, start_date, end_date

**Badges:**
- badge_id, user_id, badge_type
- date_earned, tournament_id, is_permanent

**Words (Cache Wikipedia):**
- word_name, language
- views_daily [array 30gg]
- links_out [array max 500]
- current_price, trend_pct

---

## 8. Cambiamenti v1.0 → v2.1 (Summary)

| Aspetto | v1.0 | v2.1 | Motivazione |
|---------|------|------|-------------|
| **Acquisizione** | Asta 7gg | Istantaneo | CTA immediato |
| **Titoli** | Perpetui | Contratti scadenza | Urgenza temporale |
| **Mercato** | 3gg/12gg ciclo | 24/7 continuo | Engagement continuo |
| **Scoring** | Ogni 3gg | Ogni 24h | Urgenza quotidiana |
| **Topologia** | Cambia 9gg | Cambia 1 settimana | Align weekly reset |
| **Main Leaderboard** | No | Sì real-time | Competizione immediata |
| **Weekly Tournament** | No | Sì (auto all) | Core game loop |
| **Tournament Rewards** | No | Sì (+50 top1) | Tangible, high stakes |
| **Power Tournament** | No | Sì (elite 1x mese) | Prestige, anti-AFK |
| **Badge Permanenti** | No | Sì (👑 power) | Achievement wall |
| **Max Parole** | 5 | 10 | Portfolio ricco |

---

## 9. Engagement Loop Finale

```
LUNEDÌ 09:00 - PRIMO ACCESSO:
├─ Signup → Budget 1.000 Cr
├─ Buy Bitcoin (150 Cr)
├─ Vedi main leaderboard (sei #10,000)
├─ Vedi weekly tournament (sei #5,000)
└─ "Top 10 weekly = +20 bonus! Devo salire!"

MARTEDÌ-SABATO:
├─ Monitoring portfolio principale
├─ Monitoring weekly tournament (separate leaderboard)
├─ Buy/Sell strategia per ottimizzare torneo
├─ Notifiche: "Sei salito a #512 nel torneo!"
└─ Compra altre parole, testa combinazioni

DOMENICA 21:00:
├─ Torneo finisce (115 punti totali, ranking 1243°)
├─ Vedi ranking: Top 100 ha bonus +5, tu no
└─ "Devo scalare di 1143 posizioni settimana prossima!"

LUNEDÌ PROSSIMO 09:00:
├─ Nuovo Weekly Tournament inizia
├─ Bonus precedente (zero) non applicato
├─ Check: "Sono qualificato per Power Tournament?"
│  ├─ NO: "Partecipa 3+ settimane in Top 10"
│  └─ SÌ: "Candidato Power Tournament 1° del mese!"
├─ Topologia cambia (es: STELLA → CATENA)
├─ Nuovo evento settimanale
└─ Loop continua

FINE MESE (1° Lunedì Prossimo Mese):
├─ Power Tournament inizia (se qualificato)
├─ Competizione vs 50-100 elite player
├─ +100 bonus punti per top 1 (30 giorni!)
├─ 👑 Power Champion badge (permanente)
└─ Scala in main leaderboard (con bonus)
```

---

## 10. Monetizzazione Opzionale

**Season Pass Cosmetics-Only (€4.99/mese):**

```
NO GAMEPLAY ADVANTAGE:

├─ Avatar skins
├─ Parole rare visual (Neon Bitcoin, Gold AI)
├─ Custom leaderboard frame
├─ Profile banner
├─ Chat emotes
└─ Limited edition cosmetics

UNLOCKS:
Accumula XP da tournament completion → tier cosmetics
Tier 1-10: Free (everyone)
Tier 11-30: Season pass (€4.99)
```

---

## 11. Roadmap MVP

### Fase 1 (Sett 1-2): Core
- ✅ Signup/Login
- ✅ Buy/Sell/Renew contratti
- ✅ Daily scoring
- ✅ Main leaderboard

### Fase 2 (Sett 3-4): Weekly Tournament
- ✅ Auto-entry weekly tournament
- ✅ Tournament leaderboard
- ✅ Bonus punti main game
- ✅ Badge weekly

### Fase 3 (Sett 5-6): Tattica + Power
- ✅ Jaccard intesa system
- ✅ Topologie rotanti
- ✅ Evento settimanale
- ✅ Power tournament eligibility check

### Fase 4 (Sett 7-8): Launch
- ✅ Power tournament primo event
- ✅ UI polish
- ✅ Automation launch

### Fase 5 (Sett 9+): Growth
- ✅ Season Pass optional
- ✅ Social sharing
- ✅ Email notifications

---

## 12. Rischi e Mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| **API Rate Limit** | Medium | Caching, batch, fallback |
| **Engagement Drop Day 8** | High | Weekly torneo hook |
| **Tournament Imbalance** | High | Playtesting, A/B testing |
| **Cheating Duplicates** | Medium | IP/device limit, eligibility checks |
| **Balancing Bonus Points** | High | Playtesting divisori (2000 vs 3000) |
| **Churn Month 1** | Critical | Power prestige drives retention |

---

## 13. Conclusione

**Fantasy Word v2.1** rappresenta una **rivisitazione radicale verso tournament-as-core-game-loop**.

**Key Differenziatori:**
1. ✅ **Tournament = Main Game**: Tutti partecipano settimanalmente
2. ✅ **Tangible Rewards**: +100 bonus/giorno per top 1 (25x multiplier)
3. ✅ **Scarcity + Prestige**: Power tournament elite-only (50-100 giocatori)
4. ✅ **Permanente Prestige**: 👑 Badge forever nel profilo
5. ✅ **High Stakes**: Top 1 power = game-changing advantage per mese

**Retention Targets:**
- Week 1: 50-65% (Weekly tournament hook)
- Week 2: 35-50% (Understand system)
- Week 4: 25-40% (First Power eligibility check)
- Month 1: 20-30% (Power prestige drives day 30)

**Viral Potential**: "I'm Power Champion!" > "I completed daily quest" (10x more shareable)

---

## Appendice: Formula Riassuntive

```
PUNTEGGIO_FINALE = (Punteggio_Base × Moltiplicatore_Intesa) + Bonus_Breakout + Malus_Flop + Bonus_Evento

Punteggio_Base = Views_24Ore / 2000

Jaccard(A,B) = |Links_A ∩ Links_B| / |Links_A ∪ Links_B|

Moltiplicatore_Intesa = 1.0 + Σ(bonus_connessioni) / num_connessioni

Bonus_Torneo_Settimanale = 
  Top1: +50/giorno × 7 = +350 punti settimana
  Top10: +20/giorno × 7 = +140 punti settimana
  Top100: +5/giorno × 7 = +35 punti settimana

Bonus_Torneo_Potere = 
  Top1: +100/giorno × 30 = +3000 punti mese
  Top10: +50/giorno × 30 = +1500 punti mese
  Top25: +25/giorno × 30 = +750 punti mese

Portfolio_Value = Σ(Valore_Contratti_Attuale) + Budget_Rimanente
```

---

**END OF DOCUMENT**

Versione: 2.1
Data: 15 Dicembre 2025
Status: Final Design Document
