// All tests in the authenticated describe block share one login via before().
// After loginWithMockSession() lands at /home, navigation uses SPA router
// links (click) to preserve Pinia in-memory auth state across tests.
//
// MSW (active when VITE_MOCK=true) intercepts all /api/* calls except
// /api/session, providing realistic mock data without a real backend.

describe("Dashboard: unauthenticated", () => {
  it("shows No League Selected when visiting /dashboard without login", () => {
    cy.visit("/dashboard");
    cy.contains("No League Selected").should("be.visible");
    cy.contains("Select a league from the header").should("be.visible");
  });

  it("does not show an error card when unauthenticated (just the empty state)", () => {
    cy.visit("/dashboard");
    cy.get("ion-card[color='danger']").should("not.exist");
  });
});

describe("Dashboard: authenticated via mocked session", () => {
  before(() => {
    // Single login shared across this entire describe block.
    // Never use cy.visit() after this — it reloads the page and clears Pinia state.
    cy.loginWithMockSession();
    // NavBar.onMounted triggers leagueStore.initialize() → GET /api/leagues via MSW.
    // Wait here so subsequent tests don't need to worry about the async init.
    cy.get("#league-selector", { timeout: 10000 }).should("be.visible");
  });

  it("league selector is visible in NavBar after login", () => {
    cy.get("#league-selector").should("be.visible");
  });

  it("league selector shows a league name (not empty)", () => {
    cy.get("#league-selector").should("not.contain.text", "No League Selected");
  });

  it("navigating to /dashboard via SPA nav link shows dashboard content", () => {
    cy.get(".desktop-nav").contains("Dashboard").click();
    cy.url().should("include", "/dashboard");

    // DashboardHero renders h1.team-name after dashboard data loads
    cy.get("h1.team-name", { timeout: 10000 }).should("be.visible");
  });

  it("dashboard shows the current team name from mock data", () => {
    // player-1 has teams: "I Cesarini" (italy), "Global Warriors" (global),
    // "Euro Champions" (europe). League store defaults to the first available
    // league ("global"), so the expected name is "Global Warriors".
    cy.get("h1.team-name").invoke("text").then((text) => {
      const knownTeams = ["I Cesarini", "Global Warriors", "Euro Champions"];
      expect(knownTeams.some((name) => text.includes(name))).to.be.true;
    });
  });

  it("dashboard shows a rank pill with a numeric rank", () => {
    cy.get(".rank-pill").should("be.visible");
    cy.get(".rank-pill .rank-value")
      .invoke("text")
      .should("match", /^#\d+$/);
  });

  it("League Standings section is visible in the dashboard", () => {
    cy.contains("League Standings").should("be.visible");
  });

  it("Attention Needed section is visible in the dashboard", () => {
    cy.contains("Attention Needed").should("be.visible");
  });

  it("league selector popover lists available mock leagues", () => {
    cy.get("#league-selector").click();

    cy.get("ion-popover").should("be.visible");
    // MSW mock provides: Global League, Italia League, Europe League, Americas League
    cy.get("ion-popover").contains("Global League").should("be.visible");
    cy.get("ion-popover").contains("Italia League").should("be.visible");

    // Close the popover
    cy.get("ion-popover").type("{esc}");
  });

  it("switching leagues in NavBar updates the team name on the dashboard", () => {
    cy.get("#league-selector").click();
    cy.get("ion-popover").contains("Italia League").click();

    // After switching to Italia League, player-1's team is "I Cesarini" (teams[0])
    cy.get("h1.team-name", { timeout: 10000 }).should("contain.text", "Cesarini");
  });
});
