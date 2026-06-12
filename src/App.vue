<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import GalleryView from './views/GalleryView.vue';
import LoginView from './views/LoginView.vue';
import { authEnabled, completeCallback, fetchUserEmail, logout, useAuthStore } from './auth';
import { initMedia } from './cameras';

// ready gates rendering until session restore + callback handling are done,
// so the login view doesn't flash before an existing session kicks in.
const ready = ref(!authEnabled);
const authError = ref<string | null>(null);
const userEmail = ref<string | null>(null);

const store = authEnabled ? useAuthStore() : null;
const isAuthed = computed(() => !authEnabled || Boolean(store?.isAuthenticated));

onMounted(async () => {
  if (!authEnabled) return;
  await store!.initialize(); // restore session from localStorage if present
  const err = await completeCallback();
  if (err) authError.value = err;
  ready.value = true;
});

// Request counter guards against out-of-order resolution if isAuthed
// toggles while a fetch is in flight.
let emailRequest = 0;
watch(isAuthed, async (authed) => {
  const req = ++emailRequest;
  if (authEnabled && authed) {
    // needed before multipartUrl streaming; an init failure otherwise only
    // surfaces later when a feed fetch fails, so log it here too.
    initMedia().catch((e) => console.warn('media session init failed:', e));
    const email = await fetchUserEmail();
    if (req === emailRequest) userEmail.value = email;
  } else {
    userEmail.value = null;
  }
}, { immediate: true });

async function onSignOut() {
  const err = await logout();
  if (err) authError.value = `Sign-out issue: ${err}`;
}
</script>

<template>
  <GalleryView v-if="ready && isAuthed" />
  <LoginView v-else-if="ready" :error="authError" />
  <div v-if="ready && authEnabled && isAuthed" class="user-chip">
    <span v-if="userEmail" data-testid="user-email">{{ userEmail }}</span>
    <button class="user-chip-button" data-testid="signout-button" @click="onSignOut">
      Sign out
    </button>
  </div>
</template>
