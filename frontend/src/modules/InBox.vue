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
          <ion-title slot="start" class="inbox-title">Notification Inbox</ion-title>

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
        <div v-if="loading" class="ion-padding ion-text-center">
          <ion-spinner name="crescent" color="primary" />
          <ion-text color="medium">
            <p class="ion-no-margin ion-padding-top">Loading notifications…</p>
          </ion-text>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="ion-padding ion-text-center">
          <ion-icon
            :icon="alertCircleOutline"
            color="danger"
            class="state-icon"
          />
          <ion-text color="danger">
            <p class="ion-no-margin">{{ error }}</p>
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
          v-else-if="!notifications || notifications.length === 0"
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
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-item"
            :detail="false"
          >
            <div class="ion-padding-vertical notification-row">

              <!-- Info -->
              <div class="notification-info">
                <ion-text>
                  <p class="ion-no-margin notification-from">
                    <strong>{{ notification.fromUsername }}</strong>
                  </p>
                </ion-text>

                <ion-text color="medium">
                  <p class="ion-no-margin notification-detail">
                    Wants:
                    <ion-text color="primary">
                      <strong>{{ notification.requestedArticle.name }}</strong>
                    </ion-text>
                  </p>
                </ion-text>

                <ion-text color="medium">
                  <p class="ion-no-margin notification-detail">
                    Offers:
                    <ion-text color="primary">
                      <strong v-if="notification.offeredArticle">
                        {{ notification.offeredArticle.name }}
                      </strong>
                      <strong v-if="notification.offeredCredits">
                        {{ notification.offeredCredits }} credits
                      </strong>
                    </ion-text>
                  </p>
                </ion-text>

                <!-- Contract tier chip -->
                <ion-chip
                  :color="getTierColor(notification.)"
                  outline
                  class="tier-chip"
                >
                  <ion-label>{{ notification.contract.contractTier }}</ion-label>
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

        <!-- Footer: outgoing count hint -->
        <div
          v-if="outgoingCount > 0"
          class="ion-padding-horizontal ion-padding-bottom inbox-footer"
        >
          <ion-text color="medium">
            <p class="ion-no-margin ion-text-center outgoing-hint">
              {{ outgoingCount }} outgoing notification{{
                outgoingCount !== 1 ? "s" : ""
              }}
              pending
            </p>
          </ion-text>
        </div>
      </ion-content>
    </ion-popover>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
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
import type { NotificationDTO } from "@/types/";

// ── Props ─────────────────────────────────────────────────────────────────────
// All data is passed in from the parent — this component is purely presentational
// regarding data fetching. The parent owns the query (useTrades) and passes
// slices down, keeping the component reusable regardless of context.

interface Props {
  /** Incoming pending notifications to display. */
  notifications: Notification[];
  /** Total badge count shown on the trigger button. */
  badgeCount: number;
  /** Number of outgoing pending notifications (shown as a footer hint). */
  outgoingCount?: number;
  /** League icon emoji shown on notification avatars and the league chip. */
  leagueIcon?: string;
  /** League name shown in the header chip. */
  leagueName?: string;
  /** Pass true while an accept/reject mutation is in flight. */
  actioning?: boolean;
  /** Pass true while the initial notifications fetch is loading. */
  loading?: boolean;
  /** Pass an error message string to show the error state. */
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  badgeCount: 0,
  outgoingCount: 0,
  actioning: false,
  loading: false,
  error: null,
});

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  /** User accepted a notification — parent calls the mutation. */
  accept: [tradeId: string];
  /** User rejected a notification — parent calls the mutation. */
  reject: [tradeId: string];
  /** User pressed Retry in the error state. */
  retry: [];
  /** Popover closed. */
  close: [];
}>();

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
  emit("close");
}

defineExpose({ openInbox, closeInbox });

// ── Handlers ──────────────────────────────────────────────────────────────────
function handleAccept(id: string) {
  emit("accept", id);
  // Auto-close when the last notification is acted on
  if (props.notifications.length <= 1) closeInbox();
}

function handleReject(id: string) {
  emit("reject", id);
  if (props.notifications.length <= 1) closeInbox();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTierColor(tier: string): string {
  if (tier.toLowerCase().includes("month")) return "success";
  if (tier.toLowerCase().includes("week") && tier.includes("2"))
    return "primary";
  return "warning";
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
