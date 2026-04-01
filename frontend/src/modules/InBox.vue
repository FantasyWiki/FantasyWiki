<template>
  <!-- ── Trigger slot ───────────────────────────────────────────────────── -->
  <!-- Consumers place their own trigger element and call open() via ref,  -->
  <!-- or use the default bell button by omitting the trigger slot.        -->
  <div class="inbox-wrapper">
    <slot name="trigger" :open="openInbox" :badge-count="badgeCount">
      <!-- Default trigger: bell button with badge -->
      <div class="inbox-trigger-default">
        <ion-button
          fill="outline"
          color="primary"
          class="bell-btn"
          :aria-label="`Trade inbox – ${badgeCount} pending`"
          @click="openInbox"
        >
          <ion-icon :icon="notificationsOutline" slot="icon-only" />
        </ion-button>
        <ion-badge v-if="badgeCount > 0" color="danger" class="bell-badge">
          {{ badgeCount > 9 ? "9+" : badgeCount }}
        </ion-badge>
      </div>
    </slot>

    <!-- ── Popover ─────────────────────────────────────────────────────── -->
    <ion-popover
      :is-open="isOpen"
      :event="popoverEvent"
      side="bottom"
      alignment="end"
      :show-backdrop="true"
      class="inbox-popover"
      @did-dismiss="closeInbox"
    >
      <ion-content class="ion-no-padding">
        <!-- Header -->
        <ion-toolbar color="light" class="inbox-toolbar">
          <ion-title slot="start" class="inbox-title"
            >Notification Inbox</ion-title
          >

          <div slot="end" class="ion-padding-end inbox-header-end">
            <ion-badge
              v-if="badgeCount > 0"
              color="danger"
              class="ion-margin-end"
            >
              {{ badgeCount }}
            </ion-badge>

            <ion-chip
              v-if="leagueIcon || leagueName"
              color="primary"
              outline
              class="league-chip"
            >
              <ion-label>{{ leagueIcon }} {{ leagueName }}</ion-label>
            </ion-chip>

            <ion-button
              fill="clear"
              size="small"
              color="medium"
              @click="closeInbox"
            >
              <ion-icon :icon="closeOutline" slot="icon-only" />
            </ion-button>
          </div>
        </ion-toolbar>

        <!-- Loading state -->
        <div v-if="isLoading" class="ion-padding ion-text-center">
          <ion-spinner name="crescent" color="primary" />
          <ion-text color="medium">
            <p class="ion-no-margin ion-padding-top">Loading notifications…</p>
          </ion-text>
        </div>

        <!-- Error state TODO -->
        <div v-else-if="false" class="ion-padding ion-text-center">
          <ion-icon
            :icon="alertCircleOutline"
            color="danger"
            class="state-icon"
          />
          <ion-text color="danger">
            <p class="ion-no-margin">{{}}</p>
          </ion-text>
          <ion-button
            fill="clear"
            size="small"
            color="primary"
            class="ion-margin-top"
            @click="emit('retry')"
          >
            Retry
          </ion-button>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="
            !currentLeagueNotifications ||
            currentLeagueNotifications.length === 0
          "
          class="ion-padding ion-text-center empty-state"
        >
          <ion-icon :icon="mailOpenOutline" color="medium" class="state-icon" />
          <ion-text color="medium">
            <p class="ion-no-margin">No pending notifications</p>
          </ion-text>
        </div>

        <!-- notifications list -->
        <ion-list v-else lines="full" class="inbox-list ion-no-padding">
          <ion-item
            v-for="notification in currentLeagueNotifications"
            :key="notification.id"
            class="notification-item"
            :detail="false"
          >
            <div class="ion-padding-vertical notification-row">
              <!-- Info -->
              <div class="notification-info">
                <ion-text>
                  <p class="ion-no-margin notification-from">
                    <strong>{{ notification.contract.article.title }}</strong>
                  </p>
                </ion-text>

                <ion-text color="medium">
                  <p class="ion-no-margin notification-detail">
                    {{ notification.message || "No additional details provided." }}
                  </p>
                </ion-text>

                <!-- Contract tier chip -->
                <ion-chip
                  :color="
                    getTierColor(getTier(notification.contract.duration.days))
                  "
                  outline
                  class="tier-chip"
                >
                  <ion-label>{{
                    getTier(notification.contract.duration.days)
                  }}</ion-label>
                </ion-chip>
              </div>

              <!-- Actions -->
              <div class="notification-actions">
                <ion-button
                  fill="solid"
                  color="primary"
                  size="small"
                  :disabled="actioning"
                  @click="handleAccept(notification.id)"
                >
                  <ion-icon :icon="checkmarkOutline" slot="icon-only" />
                </ion-button>
              </div>
            </div>
          </ion-item>
        </ion-list>

      </ion-content>
    </ion-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  IonBadge,
  IonButton,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import {
  alertCircleOutline,
  checkmarkOutline,
  closeOutline,
  mailOpenOutline,
  notificationsOutline,
} from "ionicons/icons";

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  /** User pressed Retry in the error state. */
  retry: [];
  /** Popover closed. */
  close: [];
}>();

// Inside InBox.vue <script setup> — no props needed for these
import { useLeagueStore } from "@/stores/league";
import { useNotifications } from "@/stores/useNotifications";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import api from "@/services/api";

const queryClient = useQueryClient();
const leagueStore = useLeagueStore();
const {
  currentLeagueNotifications,
  currentLeagueUnreadCount,
  isLoading,
} = useNotifications();

// Computed internally
const leagueIcon = computed(() => leagueStore.currentLeague?.icon);
const leagueName = computed(() => leagueStore.currentLeague?.title);
const badgeCount = computed(() => currentLeagueUnreadCount.value);

// InBox.vue — owns the mutation
const { mutate: markRead, isPending: actioning } = useMutation({
  mutationFn: (id: string) => api.notifications.markAsRead(id),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
});
// ── Local state ───────────────────────────────────────────────────────────────
const isOpen = ref(false);
const popoverEvent = ref<MouseEvent | undefined>(undefined);

// ── Public API (accessible via template ref) ──────────────────────────────────
function openInbox(event?: MouseEvent) {
  popoverEvent.value = event;
  isOpen.value = true;
}

function closeInbox() {
  isOpen.value = false;
}

// ── Handlers ──────────────────────────────────────────────────────────────────
function handleAccept(id: string) {
  // ← was: emit("accept", id)
  markRead(id);
  if (currentLeagueNotifications.value.length <= 1) closeInbox();
}

// ← delete handleReject entirely — notifications don't have a reject action
// ── Helpers ───────────────────────────────────────────────────────────────────
function getTier(duration: number) {
  if (duration <= 7) return "SHORT";
  if (duration <= 30) return "MEDIUM";
  return "LONG";
}
function getTierColor(tier: string): string {
  switch (tier) {
    case "SHORT":
      return "warning";
    case "MEDIUM":
      return "primary";
    case "LONG":
      return "success";
    default:
      return "medium";
  }
}
</script>

<style scoped>
/* ── Trigger wrapper ─────────────────────────────────────────────────────── */
.inbox-trigger-default {
  position: relative;
  display: inline-flex;
}

.bell-btn {
  --border-radius: 0.5rem;
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
}

.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.6rem;
  min-width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

/* ── Popover sizing ──────────────────────────────────────────────────────── */
.inbox-popover {
  --width: min(400px, 95vw);
  --border-radius: 0.875rem;
  --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  --backdrop-opacity: 0.15;
}

/* ── Toolbar / header ────────────────────────────────────────────────────── */
.inbox-toolbar {
  --border-width: 0 0 1px 0;
  --border-color: var(--ion-border-color);
  --min-height: 3rem;
}

.inbox-title {
  font-family: var(--font-family-headings), serif;
  font-size: 1rem;
  font-weight: 700;
  padding-inline-start: 1rem;
}

.inbox-header-end {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.league-chip {
  height: 1.4rem;
  font-size: 0.7rem;
  margin: 0;
}

/* ── State visuals ───────────────────────────────────────────────────────── */
.state-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  display: block;
}

.empty-state {
  padding-block: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* ── List ────────────────────────────────────────────────────────────────── */
.inbox-list {
  max-height: 360px;
  overflow-y: auto;
}

.notification-item {
  --padding-start: 0.875rem;
  --padding-end: 0.875rem;
  --inner-padding-end: 0;
  --min-height: 0;
}

.notification-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
}

/* Avatar */
.notification-avatar {
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  border-radius: 50%;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

/* Info column */
.notification-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-from {
  font-size: 0.875rem;
}

.notification-detail {
  font-size: 0.78rem;
}

.tier-chip {
  height: 1.25rem;
  font-size: 0.65rem;
  margin: 4px 0 0;
  align-self: flex-start;
  --background: transparent;
}

/* Actions column */
.notification-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.notification-actions ion-button {
  --border-radius: 0.375rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.inbox-footer {
  border-top: 1px solid var(--ion-border-color);
  padding-top: 0.5rem;
  margin-top: 0.25rem;
}

.outgoing-hint {
  font-size: 0.72rem;
  opacity: 0.7;
}
</style>
