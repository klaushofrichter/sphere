<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import GalleryView from './views/GalleryView.vue';
import LoginView from './views/LoginView.vue';
import { authEnabled, completeCallback, fetchUserEmail, logout, useAuthStore } from './auth';

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

watch(isAuthed, async (authed) => {
  if (authEnabled && authed) {
    userEmail.value = await fetchUserEmail();
  } else {
    userEmail.value = null;
  }
}, { immediate: true });

async function onSignOut() {
  try {
    await logout();
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Sign-out failed';
  }
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
