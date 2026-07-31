import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteLocationNormalized, RouteRecordRaw } from "vue-router";
import HomeMock from "@/views/MockHome.vue";
import TeamDashboard from "@/views/TeamDashboard.vue";
import HomePage from "@/views/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import EnvInfoPage from "@/views/EnvInfoPage.vue";
import TeamPage from "@/views/TeamPage.vue";
import TeamCreationPage from "@/views/TeamCreationPage.vue";
import MarketPage from "@/views/MarketPage.vue";
import LeaguePage from "@/views/LeaguePage.vue";
import LegalPage from "@/views/LegalPage.vue";
import GuidePage from "@/views/GuidePage.vue";
import ReportProblemPage from "@/views/ReportProblemPage.vue";
import NotFoundPage from "@/views/NotFoundPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { GLOBAL_LEAGUE_ID } from "../../../model/league";

/**
 * Keeps team creation out of reach of a player who has nothing left to create.
 * A team is one-shot per league — `teams` is `UNIQUE (playerId, leagueId)` —
 * so hand-typing the path used to end at a form whose only possible outcome
 * was a rejected submit.
 *
 * It also turns the rule TeamCreationPage reads off the route into an enforced
 * one: with no league in the path the page presents itself as signup, and this
 * is what makes "no league in the path" actually mean "brand new player".
 *
 * Membership comes from the league list (the leagues the player already has a
 * team in), fetched here when the NavBar has not populated it yet. A failed
 * fetch leaves that list empty and lets the player through on purpose: the
 * backend still refuses a duplicate, whereas redirecting on error would lock a
 * genuinely new player out of the only screen that starts the game.
 *
 * The league the entry is checked against is the one the page will actually
 * create in: the route's when it names one, the Global League otherwise. It is
 * deliberately not "is in any league" — that reading would turn away a player
 * who holds a team elsewhere but still owes their Global League one, which is
 * exactly who TeamRequiredModal sends here.
 */
async function rejectIfTeamAlreadyExists(to: RouteLocationNormalized) {
  const leagueStore = useLeagueStore();
  if (!leagueStore.availableLeagues.length) {
    await leagueStore.fetchLeagues();
  }

  const leagueId =
    (to.params.leagueId as string | undefined) ?? GLOBAL_LEAGUE_ID;
  const alreadyPlaying = leagueStore.availableLeagues.some(
    (lg) => lg.id === leagueId
  );

  return alreadyPlaying ? "/dashboard" : true;
}

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: TeamDashboard,
  },
  {
    path: "/how-it-works",
    redirect: "/home",
  },
  {
    path: "/leagues",
    name: "Leagues",
    component: HomeMock,
  },
  {
    // A league's own page: identity plus the full standings. Reached from the
    // dashboard's standings card today, and from the league dashboard that will
    // eventually replace HomeMock at /leagues.
    path: "/leagues/:leagueId",
    name: "League",
    component: LeaguePage,
  },
  {
    path: "/community",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: HomePage,
    meta: { public: true },
  },
  {
    path: "/legal",
    name: "Legal",
    component: LegalPage,
    meta: { public: true },
  },
  {
    path: "/auth/callback",
    name: "AuthCallback",
    component: AuthCallbackPage,
    meta: { public: true },
  },
  {
    path: "/env-info",
    name: "EnvInfo",
    component: EnvInfoPage,
  },
  {
    path: "/team",
    name: "Team",
    component: TeamPage,
  },
  {
    // Signup: no league named, so the page uses the Global League and carries
    // the welcome. Kept as its own path because the auth callback sends brand
    // new players straight here, before they know any league id.
    path: "/team-creation",
    name: "TeamCreation",
    component: TeamCreationPage,
    beforeEnter: rejectIfTeamAlreadyExists,
  },
  {
    // Entering a further league: same page, same form, league from the route,
    // no welcome and no tour.
    path: "/leagues/:leagueId/team-creation",
    name: "LeagueTeamCreation",
    component: TeamCreationPage,
    beforeEnter: rejectIfTeamAlreadyExists,
  },
  {
    // Onboarding is no longer a place: it is the guided tour running on top of
    // the real pages (see stores/onboarding.ts). The old path is kept as a
    // redirect so bookmarks and older links land on the tour rather than a 404.
    path: "/onboarding",
    redirect: { path: "/dashboard", query: { tour: "1" } },
  },
  {
    path: "/guide",
    name: "Guide",
    component: GuidePage,
    meta: { public: true },
  },
  {
    path: "/market",
    name: "Market",
    component: MarketPage,
  },
  {
    // Auth-gated (no `public` meta): the reporter is resolved from the session,
    // which is also what keeps the endpoint from being an open spam funnel.
    path: "/report",
    name: "Report",
    component: ReportProblemPage,
  },
  // Catch-all 404 — must stay last
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFoundPage,
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || "/"),
  routes,
});

router.beforeEach((to) => {
  const appStore = useAppStore();
  if (!to.meta.public && !appStore.isAuthenticated) {
    // Bouncing to the landing page without a word was indistinguishable from a
    // broken link. The login modal both explains the redirect and offers the
    // way out of it; it is opened before the redirect rather than after
    // because the blocked route never mounts, so the only NavBar that ends up
    // rendering is the landing page's, already reading this flag.
    appStore.openLoginModal("auth-required");
    return "/home";
  }
});

export default router;
