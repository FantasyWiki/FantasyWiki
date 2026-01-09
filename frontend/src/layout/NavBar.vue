<template>
  <!-- Top Header -->
  <ion-page>
    <ion-header class="ion-no-border transparent-top-layer">
      <ion-toolbar class="transparent-bot-layer">
        <!-- Logo -->
        <div slot="start" class="logo-container" @click="router.push('/')">
          <div class="logo-icon-wrapper">
            <ion-icon :icon="bookOutline" color="primary" />
            <div class="logo-badge"></div>
          </div>
          <ion-text class="logo-text">
            Fantasy<span class="logo-accent">Wiki</span>
          </ion-text>
        </div>

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
          <!-- Language Selector (Desktop) -->
          <ion-button fill="solid" size="small" shape="round" class="action-btn" @click="openLanguageMenu">
            <ion-icon :icon="globeOutline" slot="start" />
            {{ currentLanguage }}
          </ion-button>

          <!-- Theme Toggle -->
          <ion-button fill="solid" size="small" shape="round" class="action-btn" @click="toggleTheme">
            <ion-icon :icon="isDark ? moonOutline : sunnyOutline" />
          </ion-button>

          <!-- Sign In Button (Desktop) -->
          <ion-button color="primary" class="signin-btn ion-hide-sm-down" @click="handleAuth">
            {{ isLoggedIn ? 'Sign Out' : 'Sign In' }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <slot></slot>
    </ion-content>

  <ion-footer class="ion-hide-md-up">
    <ion-toolbar>
      <ion-segment>
        <ion-segment-button v-for="link in mobileNavLinks" :key="link.name" :value="link.tab"
          @click="router.push(link.href)">
          <ion-icon :icon="link.icon" />
          <ion-label class="ion-text-capitalize">{{ link.name }}</ion-label>
        </ion-segment-button>

        <ion-segment-button value="auth" @click="handleAuth">
          <ion-icon :icon="isLoggedIn ? logOutOutline : logInOutline" />
          <ion-label class="ion-text-capitalize">{{ isLoggedIn ? 'Sign Out' : 'Sign In' }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>
  </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonText,
  IonContent,
  IonFooter,
  IonPage,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  actionSheetController
} from '@ionic/vue';
import {
  bookOutline,
  globeOutline,
  gridOutline,
  trophyOutline,
  peopleOutline,
  moonOutline,
  sunnyOutline,
  helpCircleOutline,
  logInOutline,
  logOutOutline
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

// State
const isDark = ref(false);
const currentLanguage = ref('EN');
const isLoggedIn = ref(false);

// Navigation links configuration
const navLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: gridOutline, requiresAuth: true },
  { name: 'How It Works', href: '/how-it-works', icon: helpCircleOutline, requiresAuth: false },
  { name: 'Leagues', href: '/leagues', icon: trophyOutline, requiresAuth: true },
  { name: 'Community', href: '/community', icon: peopleOutline, requiresAuth: false },
];

// Mobile navigation (subset of desktop nav)
const mobileNavLinks = computed(() => [
  { name: 'Dashboard', href: '/dashboard', icon: gridOutline, tab: 'dashboard' },
  { name: 'How It Works', href: '/how-it-works', icon: helpCircleOutline, tab: 'how' },
  { name: 'Leagues', href: '/leagues', icon: trophyOutline, tab: 'leagues' },
  { name: 'Community', href: '/community', icon: peopleOutline, tab: 'community' },
]);

// Check if route is active
const isActive = (href: string) => {
  return route.path === href;
};

// Theme toggle
const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.body.classList.toggle('ion-palette-dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

// Language selector
const openLanguageMenu = async () => {
  const actionSheet = await actionSheetController.create({
    header: 'Select Language',
    buttons: [
      { text: 'English', handler: () => { currentLanguage.value = 'EN'; } },
      { text: 'Español', handler: () => { currentLanguage.value = 'ES'; } },
      { text: 'Français', handler: () => { currentLanguage.value = 'FR'; } },
      { text: 'Deutsch', handler: () => { currentLanguage.value = 'DE'; } },
      { text: '日本語', handler: () => { currentLanguage.value = 'JP'; } },
      { text: 'Cancel', role: 'cancel' }
    ]
  });
  await actionSheet.present();
};

// Auth handler
const handleAuth = () => {
  if (isLoggedIn.value) {
    // Handle sign out
    isLoggedIn.value = false;
    router.push('/');
  } else {
    // Handle sign in
    router.push('/signin');
  }
};
</script>

<style scoped>
.nav-link {
	--ion-toolbar-color: var(--ion-text-color);
}

.action-btn {
  --color: var(--ion-color-dark);
  --background: var(--ion-background-color-step-100);
}


/* ===================================
   HEADER & TOOLBAR
   ================================== */
.transparent-top-layer {
  background: rgba(var(--ion-background-color-rgb), 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.transparent-bot-layer {
  --background: transparent;
  --min-height: 64px;
  --padding-start: 16px;
  --padding-end: 16px;
}

ion-toolbar {
  border-bottom: 1px solid var(--ion-border-color);
}

/* ===================================
   LOGO
   ================================== */

.logo-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.logo-icon-wrapper:hover {
  transform: scale(1.05);
}

.logo-icon-wrapper {
  position: relative;
}

.logo-icon-wrapper ion-icon {
  font-size: 32px;
  transition: transform 0.2s ease;
}

.logo-container:hover .logo-icon-wrapper ion-icon {
  transform: scale(1.1);
}

.logo-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: var(--wiki-gold);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.logo-text {
  font-family: 'Libre Baskerville', serif;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ion-text-color);
}

.logo-accent {
  color: var(--ion-color-primary);
  font-family: 'Libre Baskerville', serif;
}

/* ===================================
   DESKTOP NAVIGATION
   ================================== */

.desktop-nav {
  display: flex;
  gap: 4px;
  align-items: center;
}

.nav-link {
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  transition: all 0.2s ease;
}

.nav-link ion-icon {
  font-size: 1.125rem;
  margin-right: 4px;
}

.nav-link:hover {
  --color: var(--ion-color-primary);
}

.nav-link.active {
  --color: var(--ion-color-primary);
  font-weight: 600;
}

/* ===================================
   RIGHT ACTIONS
   ================================== */

.actions-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 0.875rem;
  text-transform: none;
}

.action-btn:hover {
  --color: var(--ion-color-primary);
}

.action-btn ion-icon {
  font-size: 1.25rem;
}

.signin-btn {
  --padding-start: 20px;
  --padding-end: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: none;
  margin-left: 8px;
}

ion-footer {
  border-top: 1px solid var(--ion-background-color-step-350);
}

</style>