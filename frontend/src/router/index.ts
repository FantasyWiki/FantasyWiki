import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import HomeMock from '@/views/MockHome.vue';
import HomePage from '@/views/HomePage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: HomePage
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/leagues',
    name: 'Leagues',
    component: HomeMock
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
