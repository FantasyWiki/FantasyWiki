const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ============= MOCK DATA =============

// Articles Database
const articles = [
  { id: "art-1", name: "Bitcoin", domain: "itwiki" },
  { id: "art-2", name: "Ethereum", domain: "itwiki" },
  { id: "art-3", name: "Intelligenza Artificiale", domain: "itwiki" },
  { id: "art-4", name: "Machine Learning", domain: "itwiki" },
  { id: "art-5", name: "Cloud Computing", domain: "itwiki" },
  { id: "art-6", name: "Blockchain", domain: "itwiki" },
  { id: "art-7", name: "Python", domain: "itwiki" },
  { id: "art-8", name: "JavaScript", domain: "itwiki" },
  { id: "art-9", name: "React", domain: "itwiki" },
  { id: "art-10", name: "TypeScript", domain: "itwiki" },
];

// Leagues Database
const leagues = [
  {
    id: "global",
    name: "Global League",
    icon: "🌐",
    season: "2024",
    language: "All Languages",
    totalPlayers: 10523,
    endDate: "Mar 31, 2024",
  },
  {
    id: "italy",
    name: "Italia League",
    icon: "🍕",
    season: "2024",
    language: "Italiano",
    totalPlayers: 523,
    endDate: "Feb 28, 2024",
  },
  {
    id: "europe",
    name: "Europe League",
    icon: "🇪🇺",
    season: "2024",
    language: "Multiple",
    totalPlayers: 2456,
    endDate: "Mar 15, 2024",
  },
];

// Players Database
const players = [
  {
    id: "player-1",
    username: "Mario_Rossi",
    email: "mario@example.com",
    createdAt: "2024-01-01",
  },
  {
    id: "player-2",
    username: "WikiMaster",
    email: "wiki@example.com",
    createdAt: "2024-01-05",
  },
  {
    id: "player-3",
    username: "DataKing",
    email: "data@example.com",
    createdAt: "2024-01-10",
  },
];

// Current logged-in player (for demo purposes)
const currentPlayerId = "player-1";

// Teams Database (each player has teams in different leagues)
const teams = [
  {
    id: "team-1",
    name: "I Cesarini",
    playerId: "player-1",
    leagueId: "italy",
    credits: 550,
    totalValue: 1000,
    rank: 4,
    points: 7250,
    yesterdayPoints: 127,
    pointsChange: 12.5,
  },
  {
    id: "team-2",
    name: "Global Warriors",
    playerId: "player-1",
    leagueId: "global",
    credits: 800,
    totalValue: 1500,
    rank: 15,
    points: 12750,
    yesterdayPoints: 185,
    pointsChange: 8.3,
  },
  {
    id: "team-3",
    name: "Euro Champions",
    playerId: "player-1",
    leagueId: "europe",
    credits: 320,
    totalValue: 900,
    rank: 8,
    points: 8950,
    yesterdayPoints: 142,
    pointsChange: -2.1,
  },
  // Other players' teams
  {
    id: "team-4",
    name: "Wiki Masters",
    playerId: "player-2",
    leagueId: "italy",
    credits: 200,
    totalValue: 1200,
    rank: 1,
    points: 8950,
    yesterdayPoints: 165,
    pointsChange: 18.3,
  },
  {
    id: "team-5",
    name: "Data Lords",
    playerId: "player-3",
    leagueId: "italy",
    credits: 450,
    totalValue: 1100,
    rank: 2,
    points: 8420,
    yesterdayPoints: 158,
    pointsChange: 14.1,
  },
];

// Contracts Database
const contracts = [
  {
    id: "ctr-1",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-1",
    purchasePrice: 150,
    currentPrice: 165,
    yesterdayPoints: 45,
    change: 12.5,
    expiresIn: 2,
    tier: "MEDIUM",
    contractEnd: "2024-02-12",
    contractLength: "2 Weeks",
    purchaseDate: "2024-01-29",
  },
  {
    id: "ctr-2",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-2",
    purchasePrice: 120,
    currentPrice: 115,
    yesterdayPoints: 38,
    change: -4.2,
    expiresIn: 5,
    tier: "MEDIUM",
    contractEnd: "2024-02-15",
    contractLength: "2 Weeks",
    purchaseDate: "2024-02-01",
  },
  {
    id: "ctr-3",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-3",
    purchasePrice: 200,
    currentPrice: 220,
    yesterdayPoints: 42,
    change: 10.0,
    expiresIn: 1,
    tier: "LONG",
    contractEnd: "2024-02-11",
    contractLength: "1 Month",
    purchaseDate: "2024-01-11",
  },
  {
    id: "ctr-4",
    teamId: "team-1",
    leagueId: "italy",
    articleId: "art-4",
    purchasePrice: 80,
    currentPrice: 85,
    yesterdayPoints: 2,
    change: 6.3,
    expiresIn: 7,
    tier: "SHORT",
    contractEnd: "2024-02-17",
    contractLength: "1 Week",
    purchaseDate: "2024-02-03",
  },
  // Contracts for global team
  {
    id: "ctr-5",
    teamId: "team-2",
    leagueId: "global",
    articleId: "art-5",
    purchasePrice: 180,
    currentPrice: 195,
    yesterdayPoints: 52,
    change: 8.3,
    expiresIn: 10,
    tier: "LONG",
    contractEnd: "2024-02-20",
    contractLength: "1 Month",
    purchaseDate: "2024-01-20",
  },
  {
    id: "ctr-6",
    teamId: "team-2",
    leagueId: "global",
    articleId: "art-6",
    purchasePrice: 140,
    currentPrice: 155,
    yesterdayPoints: 48,
    change: 10.7,
    expiresIn: 4,
    tier: "MEDIUM",
    contractEnd: "2024-02-14",
    contractLength: "2 Weeks",
    purchaseDate: "2024-01-31",
  },
];

// Leaderboard Database (per league)
const leaderboards = {
  italy: [
    {
      rank: 1,
      teamId: "team-4",
      playerId: "player-2",
      username: "WikiMaster",
      teamName: "Wiki Masters",
      points: 8950,
      change: 18.3,
    },
    {
      rank: 2,
      teamId: "team-5",
      playerId: "player-3",
      username: "DataKing",
      teamName: "Data Lords",
      points: 8420,
      change: 14.1,
    },
    {
      rank: 3,
      teamId: "team-6",
      playerId: "player-4",
      username: "ArticlePro",
      teamName: "Article Pros",
      points: 7890,
      change: 11.5,
    },
    {
      rank: 4,
      teamId: "team-1",
      playerId: "player-1",
      username: "Mario_Rossi",
      teamName: "I Cesarini",
      points: 7250,
      change: 12.5,
    },
    {
      rank: 5,
      teamId: "team-7",
      playerId: "player-5",
      username: "InfoMaster",
      teamName: "Info Masters",
      points: 6800,
      change: 6.4,
    },
  ],
  global: [
    {
      rank: 1,
      teamId: "team-10",
      playerId: "player-6",
      username: "GlobalKing",
      teamName: "Global Kings",
      points: 15420,
      change: 15.2,
    },
    {
      rank: 2,
      teamId: "team-11",
      playerId: "player-7",
      username: "WorldWide",
      teamName: "World Wide",
      points: 14890,
      change: 12.8,
    },
    {
      rank: 15,
      teamId: "team-2",
      playerId: "player-1",
      username: "Mario_Rossi",
      teamName: "Global Warriors",
      points: 12750,
      change: 8.3,
    },
  ],
  europe: [
    {
      rank: 1,
      teamId: "team-15",
      playerId: "player-8",
      username: "EuroChamp",
      teamName: "Euro Champs",
      points: 10200,
      change: 16.5,
    },
    {
      rank: 8,
      teamId: "team-3",
      playerId: "player-1",
      username: "Mario_Rossi",
      teamName: "Euro Champions",
      points: 8950,
      change: -2.1,
    },
  ],
};

// Notifications Database
const notifications = [
  {
    id: "notif-1",
    leagueId: "italy",
    teamId: "team-1",
    message: "Contratto in scadenza: Bitcoin",
    type: "contract_expiring",
    read: false,
    createdAt: "2024-02-09T10:00:00Z",
  },
  {
    id: "notif-2",
    leagueId: "italy",
    teamId: "team-1",
    message: "Nuovo trade disponibile!",
    type: "trade_offer",
    extra: "ctr-3",
    read: false,
    createdAt: "2024-02-09T08:30:00Z",
  },
  {
    id: "notif-3",
    leagueId: "global",
    teamId: "team-2",
    message: "Classifica aggiornata",
    type: "league_update",
    read: true,
    createdAt: "2024-02-08T15:00:00Z",
  },
];

// ============= API ENDPOINTS =============

// GET /api/player - Get current player info
app.get("/api/player", (req, res) => {
  const player = players.find((p) => p.id === currentPlayerId);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }
  res.json(player);
});

// GET /api/leagues - Get all leagues
app.get("/api/leagues", (req, res) => {
  res.json(leagues);
});

// GET /api/leagues/:leagueId - Get specific league details
app.get("/api/leagues/:leagueId", (req, res) => {
  const { leagueId } = req.params;
  const league = leagues.find((l) => l.id === leagueId);

  if (!league) {
    return res.status(404).json({ error: "League not found" });
  }

  res.json(league);
});

// GET /api/teams - Get all teams for current player
app.get("/api/teams", (req, res) => {
  const playerTeams = teams.filter((t) => t.playerId === currentPlayerId);
  res.json(playerTeams);
});

// GET /api/teams/:teamId - Get specific team details
app.get("/api/teams/:teamId", (req, res) => {
  const { teamId } = req.params;
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  // Check if team belongs to current player
  if (team.playerId !== currentPlayerId) {
    return res.status(403).json({ error: "Access denied" });
  }

  res.json(team);
});

// GET /api/leagues/:leagueId/team - Get player's team in specific league
app.get("/api/leagues/:leagueId/team", (req, res) => {
  const { leagueId } = req.params;
  const team = teams.find(
    (t) => t.playerId === currentPlayerId && t.leagueId === leagueId,
  );

  if (!team) {
    return res.status(404).json({ error: "No team found for this league" });
  }

  res.json(team);
});

// GET /api/teams/:teamId/contracts - Get all contracts for a team
app.get("/api/teams/:teamId/contracts", (req, res) => {
  const { teamId } = req.params;

  const teamContracts = contracts.filter((c) => c.teamId === teamId);

  // Enrich contracts with article details
  const enrichedContracts = teamContracts.map((contract) => {
    const article = articles.find((a) => a.id === contract.articleId);
    return {
      ...contract,
      article,
    };
  });

  res.json(enrichedContracts);
});

// GET /api/leagues/:leagueId/contracts - Get all contracts for a league (for current player)
app.get("/api/leagues/:leagueId/contracts", (req, res) => {
  const { leagueId } = req.params;

  // Find player's team in this league
  const team = teams.find(
    (t) => t.playerId === currentPlayerId && t.leagueId === leagueId,
  );

  if (!team) {
    return res.json([]);
  }

  const leagueContracts = contracts.filter((c) => c.teamId === team.id);

  // Enrich with article details
  const enrichedContracts = leagueContracts.map((contract) => {
    const article = articles.find((a) => a.id === contract.articleId);
    return {
      ...contract,
      article,
    };
  });

  res.json(enrichedContracts);
});

// GET /api/contracts/:contractId - Get specific contract details
app.get("/api/contracts/:contractId", (req, res) => {
  const { contractId } = req.params;
  const contract = contracts.find((c) => c.id === contractId);

  if (!contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  // Enrich with article details
  const article = articles.find((a) => a.id === contract.articleId);

  res.json({
    ...contract,
    article,
  });
});

// GET /api/leagues/:leagueId/leaderboard - Get leaderboard for a league
app.get("/api/leagues/:leagueId/leaderboard", (req, res) => {
  const { leagueId } = req.params;
  const leaderboard = leaderboards[leagueId] || [];

  res.json(leaderboard);
});

// GET /api/leagues/:leagueId/notifications - Get notifications for a league
app.get("/api/leagues/:leagueId/notifications", (req, res) => {
  const { leagueId } = req.params;
  const leagueNotifications = notifications.filter(
    (n) => n.leagueId === leagueId,
  );

  res.json(leagueNotifications);
});

// GET /api/notifications - Get all notifications for current player
app.get("/api/notifications", (req, res) => {
  // Get all teams for current player
  const playerTeamIds = teams
    .filter((t) => t.playerId === currentPlayerId)
    .map((t) => t.id);

  // Get notifications for these teams
  const playerNotifications = notifications.filter((n) =>
    playerTeamIds.includes(n.teamId),
  );

  res.json(playerNotifications);
});

// PATCH /api/notifications/:notificationId/read - Mark notification as read
app.patch("/api/notifications/:notificationId/read", (req, res) => {
  const { notificationId } = req.params;
  const notification = notifications.find((n) => n.id === notificationId);

  if (!notification) {
    return res.status(404).json({ error: "Notification not found" });
  }

  notification.read = true;
  res.json(notification);
});

// GET /api/articles - Get all available articles
app.get("/api/articles", (req, res) => {
  res.json(articles);
});

// GET /api/articles/:articleId - Get specific article
app.get("/api/articles/:articleId", (req, res) => {
  const { articleId } = req.params;
  const article = articles.find((a) => a.id === articleId);

  if (!article) {
    return res.status(404).json({ error: "Article not found" });
  }

  res.json(article);
});

// POST /api/teams/:teamId/contracts - Create new contract (buy article)
app.post("/api/teams/:teamId/contracts", (req, res) => {
  const { teamId } = req.params;
  const { articleId, tier, purchasePrice } = req.body;

  const team = teams.find(
    (t) => t.id === teamId && t.playerId === currentPlayerId,
  );

  if (!team) {
    return res.status(404).json({ error: "Team not found" });
  }

  if (team.credits < purchasePrice) {
    return res.status(400).json({ error: "Insufficient credits" });
  }

  // Create new contract
  const newContract = {
    id: `ctr-${Date.now()}`,
    teamId,
    leagueId: team.leagueId,
    articleId,
    purchasePrice,
    currentPrice: purchasePrice,
    yesterdayPoints: 0,
    change: 0,
    expiresIn: tier === "SHORT" ? 7 : tier === "MEDIUM" ? 14 : 30,
    tier,
    contractEnd: new Date(
      Date.now() +
        (tier === "SHORT" ? 7 : tier === "MEDIUM" ? 14 : 30) *
          24 *
          60 *
          60 *
          1000,
    )
      .toISOString()
      .split("T")[0],
    contractLength:
      tier === "SHORT" ? "1 Week" : tier === "MEDIUM" ? "2 Weeks" : "1 Month",
    purchaseDate: new Date().toISOString().split("T")[0],
  };

  contracts.push(newContract);
  team.credits -= purchasePrice;

  const article = articles.find((a) => a.id === articleId);

  res.status(201).json({
    ...newContract,
    article,
  });
});

// DELETE /api/contracts/:contractId - Delete/sell contract
app.delete("/api/contracts/:contractId", (req, res) => {
  const { contractId } = req.params;
  const contractIndex = contracts.findIndex((c) => c.id === contractId);

  if (contractIndex === -1) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const contract = contracts[contractIndex];
  const team = teams.find(
    (t) => t.id === contract.teamId && t.playerId === currentPlayerId,
  );

  if (!team) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Return credits to team
  team.credits += contract.currentPrice;

  // Remove contract
  contracts.splice(contractIndex, 1);

  res.json({
    message: "Contract deleted successfully",
    refundedCredits: contract.currentPrice,
  });
});

// GET /api/dashboard/:leagueId - Get complete dashboard data for a league
app.get("/api/dashboard/:leagueId", (req, res) => {
  const { leagueId } = req.params;

  // Get player's team in this league
  const team = teams.find(
    (t) => t.playerId === currentPlayerId && t.leagueId === leagueId,
  );

  if (!team) {
    return res.status(404).json({ error: "No team found for this league" });
  }

  // Get contracts for this team
  const teamContracts = contracts.filter((c) => c.teamId === team.id);
  const enrichedContracts = teamContracts.map((contract) => {
    const article = articles.find((a) => a.id === contract.articleId);
    return { ...contract, article };
  });

  // Get leaderboard
  const leaderboard = leaderboards[leagueId] || [];

  // Get league details
  const league = leagues.find((l) => l.id === leagueId);

  // Get notifications
  const teamNotifications = notifications.filter((n) => n.teamId === team.id);

  // Calculate summary stats
  const activeContracts = teamContracts.length;
  const maxContracts = 10;
  const portfolioValue = teamContracts.reduce(
    (sum, c) => sum + c.currentPrice,
    0,
  );

  res.json({
    team,
    league,
    contracts: enrichedContracts,
    leaderboard,
    notifications: teamNotifications,
    summary: {
      yesterdayPoints: team.yesterdayPoints,
      pointsChange: team.pointsChange,
      rank: team.rank,
      totalPlayers: league?.totalPlayers || 0,
      credits: team.credits,
      portfolioValue,
      activeContracts,
      maxContracts,
    },
  });
});

// ============= SERVER START =============

app.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log(`\n📚 Available endpoints:`);
  console.log(`  GET  /api/player`);
  console.log(`  GET  /api/leagues`);
  console.log(`  GET  /api/leagues/:leagueId`);
  console.log(`  GET  /api/teams`);
  console.log(`  GET  /api/teams/:teamId`);
  console.log(`  GET  /api/leagues/:leagueId/team`);
  console.log(`  GET  /api/teams/:teamId/contracts`);
  console.log(`  GET  /api/leagues/:leagueId/contracts`);
  console.log(`  GET  /api/contracts/:contractId`);
  console.log(`  GET  /api/leagues/:leagueId/leaderboard`);
  console.log(`  GET  /api/leagues/:leagueId/notifications`);
  console.log(`  GET  /api/notifications`);
  console.log(`  GET  /api/articles`);
  console.log(`  GET  /api/dashboard/:leagueId`);
  console.log(`  POST /api/teams/:teamId/contracts`);
  console.log(`  DELETE /api/contracts/:contractId`);
  console.log(`  PATCH /api/notifications/:notificationId/read`);
});
