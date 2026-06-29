import type { MessageSchema } from "./en";

// Italian message catalog. Typed against the English schema so a missing or
// misspelled key is a compile error, not a silent fallback.
const it: MessageSchema = {
  common: {
    retry: "Riprova",
    close: "Chiudi",
  },

  nav: {
    dashboard: "Dashboard",
    leagues: "Leghe",
    market: "Mercato",
    signIn: "Accedi con Google",
    signOut: "Esci",
  },

  home: {
    hero: {
      badge: "Il fanta calcio incontra Wikipedia",
      title: "Transforma il {empire}",
      titleEmphasis: "Sapere in Potere",
      description:
        "Acquista articoli di Wikipedia, guadagna punti dalle tendenze di ricerca reali e competi nei tornei settimanali. Il fanta gioco definitivo per le menti curiose.",
      getStarted: "Inizia ora",
      creditsNote:
        "Inizia con 1.000 crediti • Nessuna carta di credito richiesta",
    },
    stats: {
      articlesDrafted: "Articoli acquistati",
      pointsEarned: "Punti guadagnati",
      activeUsers: "Utenti attivi",
    },
    howItWorks: {
      title: "Come funziona {brand}",
      subtitle:
        "Unisciti a migliaia di giocatori che competono nel gioco fantasy basato sulla conoscenza definitivo.",
      search: {
        title: "Cerca articoli",
        description:
          "Esplora milioni di articoli di Wikipedia. Trova argomenti di tendenza, gemme nascoste o i tuoi temi preferiti.",
      },
      portfolio: {
        title: "Costruisci il tuo portfolio",
        description:
          "Acquista articoli con i tuoi 1.000 crediti iniziali. Scegli durate dei contratti da 3 a 90 giorni.",
      },
      points: {
        title: "Guadagna punti ogni giorno",
        description:
          "Ottieni punti in base alle visualizzazioni reali di Wikipedia. Articoli di tendenza = più punti!",
      },
      compete: {
        title: "Competi e vinci",
        description:
          "Scala la classifica, partecipa ai tornei settimanali e guadagna ricompense bonus.",
      },
    },
    features: {
      title: "Funzionalità presenti",
      subtitle:
        "Tutto ciò di cui hai bisogno per l'esperienza fantasy della conoscenza definitiva.",
      liveMarkets: {
        title: "Mercati attivi 24/7",
        description:
          "Compra, vendi e scambia articoli in qualsiasi momento. Il mercato non dorme mai.",
      },
      realTimeScoring: {
        title: "Punteggio in tempo reale",
        description:
          "Punti calcolati ogni giorno dai dati reali di visualizzazione di Wikipedia.",
      },
      chemistry: {
        title: "Bonus intesa",
        description:
          "Collega articoli correlati per punti bonus, in stile FIFA.",
      },
      dynamicPricing: {
        title: "Prezzi dinamici",
        description:
          "I prezzi degli articoli si adattano agli argomenti di tendenza e alla domanda.",
      },
      privateLeagues: {
        title: "Leghe private",
        description: "Crea leghe private e competi con gli amici.",
      },
      weeklyTournaments: {
        title: "Tornei settimanali",
        description:
          "Partecipa alle competizioni settimanali automatiche per ricompense bonus.",
      },
      powerTournaments: {
        title: "Tornei del potere",
        description: "Competizioni d'élite mensili per i migliori giocatori.",
      },
      fairPlay: {
        title: "Fair Play",
        description:
          "Sistema di punteggio trasparente basato su dati pubblici.",
      },
    },
    leaderboardPreview: {
      badge: "Torneo settimanale",
      title: "Competi per la {glory}",
      titleEmphasis: "Gloria",
      subtitle:
        "Ogni settimana, tutti i giocatori attivi entrano automaticamente in un torneo competitivo. Scala le classifiche, guadagna punti bonus e dimostra il tuo dominio della conoscenza.",
      top10: {
        rank: "Top 10",
        description: "+20 punti bonus/giorno nel gioco principale",
      },
      top100: {
        rank: "Top 100",
        description: "+10 punti bonus/giorno nel gioco principale",
      },
      top1000: {
        rank: "Top 1000",
        description: "+5 punti bonus/giorno nel gioco principale",
      },
      joinCompetition: "Partecipa alla competizione",
      globalLeaderboard: "🏆 Classifica globale",
      updatedDaily: "Aggiornata ogni giorno",
      yourRank: "La tua posizione",
    },
    articleLeaderboard: {
      trendingToday: "🔥 Di tendenza oggi",
      mostViewed: "Più visti",
      goingUp: "In crescita",
      avg: "Media: {value}",
      perDay: "/giorno",
      unavailable: "Dati sugli articoli non disponibili al momento.",
      liveData: "📡 Dati live",
      viewsToday: "Oltre {volume} visualizzazioni oggi",
      viewsUnavailable: "Totale visualizzazioni non disponibile al momento",
    },
    cta: {
      badge: "Inizia a giocare oggi",
      title: "Pronto a transformare il tuo Sapere in Potere?",
      description:
        "Unisciti a migliaia di giocatori che già competono nel primo gioco fantasy al mondo basato su Wikipedia. Inizia con 1.000 crediti gratuiti.",
      createAccount: "Crea un account gratuito",
      footer: "Nessuna carta di credito richiesta • Gratis • Vinci premi reali",
    },
  },

  dashboard: {
    hero: {
      welcomeBack: "Bentornato",
      yourTeam: "La tua squadra",
      yesterdayPoints: "Punti di ieri",
      credits: "Crediti",
      contracts: "Contratti",
      standing: "Posizione",
      portfolio: "Portfolio: {value} Cr",
      slotsFree: "{count} slot liberi",
      rankOf: "su {count}",
      standingSub: "su {count} giocatori",
      buyArticles: "Acquista articoli",
      showStat: "Mostra statistica {index}",
    },
    leaderboard: {
      title: "Classifica della lega",
      players: "{count} giocatori",
      ends: "Termina {date}",
      you: "Tu",
      points: "{points} pti",
      viewDetails: "Visualizza dettagli lega",
    },
    teamManagement: {
      title: "Formazione squadra",
      manage: "Gestisci",
    },
    neededAttention: {
      title: "Attenzione richiesta",
      requiringAction:
        "{count} contratto richiede un'azione | {count} contratti richiedono un'azione",
      allHealthy: "Tutti i contratti sono in salute",
      buyMore: "Acquista altri",
      noneNeedAttention: "Nessun contratto richiede attenzione al momento",
      renew: "Rinnova",
      dismiss: "Rimuovi",
      left: "{duration} rimanenti",
    },
  },

  formation: {
    selector: {
      label: "Formazione",
    },
    bench: {
      title: "Panchina",
      count: "{count} articolo | {count} articoli",
      empty: "Nessun articolo in panchina",
      emptyHint: "Acquista articoli dal mercato per aggiungerli qui",
    },
    pitch: {
      swapInstruction: "Seleziona la posizione con cui scambiare",
      chemistry: {
        excellent: "eccellente",
        good: "buono",
        weak: "debole",
        empty: "vuoto",
      },
    },
  },

  articleDetail: {
    actions: {
      buy: "Acquista",
      renewContract: "Rinnova contratto",
      swapArticle: "Scambia articolo",
    },
    contract: {
      title: "Dettagli contratto",
      tier: "Livello",
      expiresIn: "Scade tra",
      urgent: "Urgente",
      renewSoon: "Rinnova presto",
      healthy: "In salute",
    },
    stats: {
      title: "Informazioni articolo",
      currentPrice: "Prezzo attuale",
      availability: "Disponibilità",
      purchasePrice: "Prezzo di acquisto",
      valueTracking: "Andamento valore",
      credits: "{count} crediti",
      freeAgent: "Svincolato",
      ownedBy: "Di proprietà di {name}",
      owned: "Di proprietà",
    },
    description: {
      openOnWikipedia: "Apri su Wikipedia",
      loadingSummary: "Caricamento riepilogo...",
      summaryUnavailable: "Riepilogo non disponibile.",
      more: "altro...",
      less: "meno",
      expandSummary: "Espandi riepilogo",
      collapseSummary: "Comprimi riepilogo",
    },
    ownership: {
      resolving: "Risoluzione proprietà...",
      unableToDetermine: "Impossibile determinare la proprietà",
      resolvingSubtitle:
        "Le azioni appariranno quando il contesto della tua squadra sarà pronto.",
      refreshTryAgain: "Aggiorna e riprova.",
      retryCheck: "Riprova verifica proprietà",
    },
  },

  inbox: {
    tradeInbox: "Casella scambi – {count} in sospeso",
    title: "Casella notifiche",
    loading: "Caricamento notifiche…",
    empty: "Nessuna notifica in sospeso",
    noDetails: "Nessun dettaglio aggiuntivo fornito.",
  },

  auth: {
    login: {
      subtitle: "Accedi per gestire le tue leghe e seguire la tua squadra.",
      authFailed: "Autenticazione fallita. Riprova.",
      signInGoogle: "Accedi con Google",
      termsPrefix: "Accedendo accetti i nostri {terms} e la {privacy}.",
      terms: "Termini di servizio",
      privacy: "Informativa sulla privacy",
    },
    callback: {
      signInFailed: "Accesso fallito",
      tryAgain: "Riprova",
      signingIn: "Accesso in corso…",
    },
  },

  market: {
    title: "Mercato articoli",
    subtitle: "Cerca e acquista articoli di Wikipedia",
    balance: "Saldo",
    searchPlaceholder: "Cerca articoli…",
    filterAll: "Tutti",
    filterFree: "Svincolati",
    filterOwned: "Acquistati",
    colArticle: "Articolo",
    colStatus: "Stato",
    colYesterday: "Ieri",
    colWeek: "Settimana",
    colMonth: "Mese",
    colYear: "Anno",
    colPrice: "Prezzo",
    freeAgent: "Svincolato",
    noArticles: "Nessun articolo trovato",
    noSearchResults: "Nessun articolo Wikipedia trovato per questa ricerca",
    searching: "Ricerca su Wikipedia…",
    searchFallbackNote: 'Risultati Wikipedia per "{query}"',
    loading: "Caricamento mercato…",
    errorTitle: "Caricamento mercato non riuscito",
    retry: "Riprova",
    paginationInfo: "Mostrando {from}–{to} di {total}",
    sortLabel: "Ordina:",
  },

  views: {
    teamDashboard: {
      loading: "Caricamento dashboard…",
      errorTitle: "Errore nel caricamento della dashboard",
      noLeagueTitle: "Nessuna lega selezionata",
      noLeagueHint:
        "Seleziona una lega dalla navbar per visualizzare la tua dashboard.",
    },
    teamPage: {
      title: "Gestione squadra",
      failedToLoad: "Caricamento squadra non riuscito",
      save: "Salva",
      saving: "Salvataggio…",
      unsavedChanges: "Modifiche non salvate",
      retry: "Riprova",
    },
    envInfo: {
      title: "Informazioni ambiente",
      variables: "Variabili d'ambiente",
      runtimeBackendUrl: "URL backend runtime",
      notSet: "(non impostato)",
    },
  },
  asyncIndicator: {
    loading: "Caricando...",
  },
};

export default it;
