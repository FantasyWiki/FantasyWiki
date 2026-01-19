<template>
  <!-- Top Header -->
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border ion-padding-horizontal transparent-top-layer" >
      <ion-toolbar class="transparent-bot-layer ion-padding-horizontal">
         <app-logo slot="start"></app-logo>

        <!-- Desktop Navigation -->
        <div class="desktop-nav ion-hide-md-down">
          <ion-button v-for="link in navLinks" :key="link.name" :router-link="link.href" router-direction="forward"
            fill="clear" class="nav-link" :class="{ 'active': isActive(link.href) }">
            <ion-icon v-if="link.icon" :icon="link.icon" slot="start" />
            {{ link.name }}
          </ion-button>
        </div>

        <!-- Right Actions -->
        <div slot="end" class="actions-container">
          <!-- League Selector -->
          <ion-button fill="solid" size="small" shape="round"  @click="">
            <ion-text>{{leagueStore.currentLeague.icon}}</ion-text>
            <ion-text class="ion-hide-sm-down">{{ leagueStore.currentLeague.name }}</ion-text>
          </ion-button>
          <!-- Language Selector -->
          <ion-button fill="solid" size="small" shape="round"  @click="openLanguageMenu">
            <ion-icon :icon="globeOutline" slot="start" />
            {{ appStore.currentLanguage.label }}
          </ion-button>

          <!-- Theme Toggle -->
          <ion-button fill="solid" size="small" shape="round" @click="toggleTheme">
            <ion-icon :icon="appStore.isDarkMode ? moonOutline : sunnyOutline" />
          </ion-button>

          <!-- Sign In Button (Desktop) -->
          <ion-button color="primary" fill="solid" class="ion-hide-sm-down" @click="handleAuth">
            {{ appStore.isAuthenticated ? 'Sign Out' : 'Sign In' }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <slot></slot>
    </ion-content>

  <!-- Mobile Footer Navigation -->
  <ion-footer class="ion-hide-md-up transparent-top-layer" :translucent="true">
    <ion-toolbar class="transparent-bot-layer">
      <div class="mobile-nav">
        <ion-button fill="clear" v-for="link in navLinks" :key="link.name" :value="link.tab"
          @click="router.push(link.href)">
          <ion-icon :icon="link.icon" />
        </ion-button>

        <ion-button fill="clear" value="auth" @click="handleAuth">
          <ion-icon :icon="appStore.isAuthenticated ? logOutOutline : logInOutline" />
        </ion-button>
      </div>
    </ion-toolbar>
  </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
  IonPage,
  actionSheetController
} from '@ionic/vue';
import {
  globeOutline,
  gridOutline,
  trophyOutline,
  moonOutline,
  sunnyOutline,
  logInOutline,
  logOutOutline, closeCircle, checkmarkCircle, storefrontOutline
} from 'ionicons/icons';
import AppLogo from '@/views/AppLogo.vue';
import {useAppStore} from "@/stores/app";
import {useLeagueStore} from "@/stores/league";

const router = useRouter();
const route = useRoute();

// State
const appStore = useAppStore()
const leagueStore = useLeagueStore()


// Navigation links configuration
const navLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: gridOutline, requiresAuth: true, tab: 'dashboard' },
  { name: 'Leagues', href: '/leagues', icon: trophyOutline, requiresAuth: true, tab: 'leagues' },
  { name: 'Market', href: '/market', icon: storefrontOutline, requiresAuth: true, tab: 'market' },

];

// Check if route is active
const isActive = (href: string) => {
  return route.path === href;
};

// Theme toggle
const toggleTheme = () => {
  appStore.toggleDarkMode()
  document.body.classList.toggle('ion-palette-dark', appStore.isDarkMode);
  localStorage.setItem('theme', appStore.isDarkMode ? 'dark' : 'light');
};

// Language selector
/**
 * Opens an action sheet for language selection
 * Shows all available languages with a checkmark on the current selection
 */
async function openLanguageMenu() {
  const actionSheet = await actionSheetController.create({
    header: 'Select Language',
    cssClass: 'language-action-sheet',
    buttons: [
      // Dynamically create buttons for each language
      ...appStore.availableLanguages.map(lang => ({
        text: `${lang.fullName} (${lang.label})`,
        icon: appStore.isLanguage(lang.code) ? checkmarkCircle : undefined,
        cssClass: appStore.isLanguage(lang.code) ? 'selected-language' : '',
        handler: () => {
          appStore.setLanguage(lang.code)
          return true // Close the action sheet
        }
      })),
      // Cancel button
      {
        text: 'Cancel',
        icon: closeCircle,
        role: 'cancel',
        cssClass: 'cancel-button',
        handler: () => {
          console.log('Language selection cancelled')
        }
      }
    ]
  })

  await actionSheet.present()

  // Optional: Get the result when action sheet is dismissed
  const { role, data } = await actionSheet.onDidDismiss()
  console.log('Action sheet dismissed with role:', role)
}


// Auth handler
const handleAuth = () => {
  if (appStore.isAuthenticated) {
    // Handle sign out
    appStore.logout()
    router.push('/');
  } else {
    // Handle sign in
    appStore.login()
    router.push('/signin');
  }
};
</script>

<style scoped>

ion-header {
  border-bottom: 1px solid var(--ion-border-color);
}

ion-toolbar {
  border-bottom: 1px solid var(--ion-border-color);
  --padding-start: 16px;
  --padding-end: 16px;
}

.transparent-top-layer {
  background: rgba(var(--ion-background-color-rgb), 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.transparent-bot-layer {
  --background: transparent;
  --min-height: 64px;
}

ion-footer {
  border-top: 1px solid var(--ion-border-color);
}

.desktop-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}

.mobile-nav {
  display: flex;
  justify-content: space-around;
  width: 100%;
}

.actions-container {
  display: flex;
  align-items: center;
  gap: 8px;
}


</style>