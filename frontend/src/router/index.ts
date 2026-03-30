import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import TeamDashboard from "@/views/TeamDashboard.vue";
import HomePage from "@/views/home-page/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";
import TeamPage from "@/views/TeamPage.vue";
import MockHome from "@/views/MockHome.vue";
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
    path: "/team",
    name: "Team",
    component: TeamPage,
  },
  {
    path: "/how-it-works",
    redirect: "/home",
  },
  {
    path: "/leagues",
    name: "Leagues",
    component: MockHome,
  },
  {
    path: "/community",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: HomePage,
  },
  {
    path: "/auth/callback",
    name: "AuthCallback",
    component: AuthCallbackPage,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
