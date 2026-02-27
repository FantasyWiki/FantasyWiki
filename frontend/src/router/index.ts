import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import HomeMock from "@/views/MockHome.vue";
import HomePage from "@/views/home-page/HomePage.vue";
import AuthCallbackPage from "@/views/auth/AuthCallbackPage.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/dashboard",
    redirect: "/home",
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
    path: "/community",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "Home",
    component: HomePage,
  },
  {
    path: "/auth/google/callback",
    name: "AuthCallback",
    component: AuthCallbackPage,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
