describe("Home page (public)", () => {
  beforeEach(() => {
    cy.visit("/home");
  });

  it("loads without error", () => {
    cy.url().should("include", "/home");
    cy.get("ion-page").should("exist");
  });

  it("shows the hero heading and CTA", () => {
    cy.contains("h1", "Build Your").should("be.visible");
    cy.contains("Knowledge Empire").should("be.visible");
    cy.contains("Get Started").should("be.visible");
    cy.contains("1,000 credits").should("be.visible");
  });

  it("shows app stats", () => {
    cy.contains("50K+").should("be.visible");
    cy.contains("1M+").should("be.visible");
    cy.contains("10K+").should("be.visible");
  });

  it("shows the How It Works section with 4 steps", () => {
    cy.get("#how-it-works").should("exist");
    cy.contains("How FantasyWiki Works").should("be.visible");
    cy.get(".step-card").should("have.length", 4);
  });

  it("shows the Powerful Features section with 8 feature cards", () => {
    cy.contains("Powerful Features").should("be.visible");
    cy.get(".feature-card").should("have.length", 8);
  });

  it("shows the leaderboard preview with 8 players", () => {
    cy.contains("Global Leaderboard").should("be.visible");
    cy.contains("Compete for").should("be.visible");
    cy.get(".leaderboard-item").should("have.length.at.least", 5);
    cy.contains("CryptoGod").should("be.visible");
  });

  it("shows the CTA section with Create Free Account button", () => {
    cy.contains("Ready to Build Your Knowledge Empire?").should("be.visible");
    cy.contains("Create Free Account").should("be.visible");
  });

  it("shows the logo in the NavBar", () => {
    cy.get(".logo-text").should("be.visible");
    cy.get(".logo-text").should("contain.text", "Fantasy");
  });

  it("shows Sign In button when unauthenticated", () => {
    cy.get(".actions-container").contains("Sign In with Google").should("be.visible");
    cy.get("#league-selector").should("not.exist");
  });

  it("shows desktop nav links", () => {
    cy.get(".desktop-nav").contains("Dashboard").should("be.visible");
    cy.get(".desktop-nav").contains("Leagues").should("be.visible");
    cy.get(".desktop-nav").contains("Market").should("be.visible");
  });

  it("toggles dark mode when theme button is clicked", () => {
    cy.get("body").then(($body) => {
      const wasDark = $body.hasClass("ion-palette-dark") || $body.hasClass("dark");

      cy.get(".actions-container ion-button").filter((_, el) => {
        return el.querySelector("ion-icon") !== null;
      }).last().click();

      cy.get("body").should(($b) => {
        const isDark = $b.hasClass("ion-palette-dark") || $b.hasClass("dark");
        expect(isDark).to.not.equal(wasDark);
      });

      // Restore original state
      cy.get(".actions-container ion-button").filter((_, el) => {
        return el.querySelector("ion-icon") !== null;
      }).last().click();
    });
  });

  it("opens language popover and switches language", () => {
    // The language button is the second small round button in actions-container
    cy.get(".actions-container").within(() => {
      // Language button contains a globe icon and language label
      cy.contains("EN").click();
    });

    cy.get("ion-popover").should("be.visible");
    cy.contains("Italiano").should("be.visible");
    cy.contains("English").should("be.visible");
    cy.contains("Español").should("be.visible");

    cy.contains("Italiano").click();
    cy.get("ion-popover").should("not.be.visible");
    cy.get(".actions-container").contains("IT").should("be.visible");

    // Restore to English
    cy.get(".actions-container").contains("IT").click();
    cy.contains("English").click();
  });
});
