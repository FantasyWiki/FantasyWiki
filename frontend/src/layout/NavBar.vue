<template>
  <ion-header class="glass-header ion-no-border">
    <ion-toolbar class="glass-toolbar">

      <!-- 1. LEFT: Logo -->
      <div slot="start" class="logo-container" @click="router.push('/')">
        <ion-icon :icon="book" class="logo-icon" />
        <span class="logo-text">FantasyWiki</span>
      </div>

      <!-- 2. CENTER: Desktop Navigation (Hidden on Mobile) -->
      <div class="desktop-nav ion-hide-md-down">
        <router-link to="/dashboard" active-class="active-link">Dashboard</router-link>
        <router-link to="/how-it-works" active-class="active-link">How It Works</router-link>
        <router-link to="/leagues" active-class="active-link">Leagues</router-link>
        <router-link to="/community" active-class="active-link">Community</router-link>
      </div>

      <!-- 3. RIGHT: Actions & User -->
      <div slot="end" class="actions-container">

        <!-- Language Switcher (Desktop Only) -->
        <ion-button fill="clear" class="lang-btn ion-hide-sm-down">
          <ion-icon :icon="globeOutline" slot="start" />
          <span class="lang-text">GB EN</span>
        </ion-button>

        <!-- Theme Toggle -->
        <ion-button fill="clear" @click="toggleTheme" class="theme-btn">
          <ion-icon :icon="isDark ? moon : sunny" />
        </ion-button>

        <!-- Sign In Button (Desktop Only) -->
        <ion-button class="signin-btn ion-hide-sm-down" color="success">
          Sign In
        </ion-button>

        <!-- Mobile Menu Trigger (Mobile Only) -->
        <ion-buttons slot="end" class="ion-hide-md-up">
          <ion-menu-button color="light"></ion-menu-button>
        </ion-buttons>
      </div>

    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonHeader, IonToolbar, IonButton, IonButtons,
  IonIcon, IonMenuButton
} from '@ionic/vue';
import {
  book, globeOutline, moon, sunny
} from 'ionicons/icons';

const router = useRouter();
const isDark = ref(true);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.body.classList.toggle('dark', isDark.value);
};
</script>

/*TODO: Color palette should be globalized*/
<style scoped>
/* GLASS HEADER CONTAINER */
.glass-header {
  /* This ensures the header itself doesn't block layout flow unnecessarily */
  background: transparent;
}

/* GLASS TOOLBAR - THE MAGIC HAPPENS HERE */
.glass-toolbar {
  /* Dark semi-transparent background */
  --background: rgba(13, 20, 17, 0.75);
  --color: white;
  --min-height: 70px;

  /* Blur Effect */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  /* Subtle bottom border */
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* LOGO */
.logo-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-left: 8px;
}

.logo-icon {
  font-size: 24px;
  color: #2ed573;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  font-family: serif; /* Matches "Wiki" style */
  letter-spacing: 0.5px;
}

/* DESKTOP NAV LINKS */
.desktop-nav {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: absolute;
  left: 50%;
  transform: translateX(-50%); /* Centers the block perfectly */
}

.desktop-nav a {
  text-decoration: none;
  color: #8fa39a;
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  padding: 8px 16px;
  border-radius: 20px;
}

.desktop-nav a:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.desktop-nav a.active-link {
  color: #fff;
  background: rgba(46, 213, 115, 0.15);
  border: 1px solid rgba(46, 213, 115, 0.3);
}

/* ACTIONS */
.actions-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lang-btn {
  --color: #aebfb5;
  font-size: 0.9rem;
  text-transform: none;
}

.theme-btn {
  --color: #aebfb5;
}

.signin-btn {
  --border-radius: 8px;
  font-weight: 600;
  text-transform: none;
  font-size: 0.95rem;
  --padding-start: 20px;
  --padding-end: 20px;
  margin-left: 8px;
}
</style>
