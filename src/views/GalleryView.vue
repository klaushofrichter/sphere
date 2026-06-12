<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { startGallery, destroyGallery } from '../galleryApp.js';
import { logout } from '../auth';

const root = ref(null);
const errorMsg = ref(null);

onMounted(async () => {
  const result = await startGallery(root.value);
  if (result?.error) errorMsg.value = result.error;
});
onUnmounted(() => { destroyGallery(); });

async function onSignOut() {
  const err = await logout();
  if (err) errorMsg.value = `Sign-out issue: ${err}`;
}
</script>

<template>
  <div>
    <div v-if="errorMsg" class="login" data-error data-testid="gallery-error">
      <h1 class="login-title">SPHERE GALLERY</h1>
      <p class="login-error">{{ errorMsg }}</p>
      <button class="login-button" data-testid="error-signout" @click="onSignOut()">Sign out</button>
    </div>
    <div ref="root" class="gallery-canvas"></div>
    <div class="vignette"></div>
    <header class="hud">SPHERE GALLERY — POC</header>
    <div id="overlay" class="overlay" aria-hidden="true">
      <button class="overlay-close" id="overlay-close">Close</button>
      <div class="overlay-inner">
        <p class="overlay-client" id="overlay-client"></p>
        <p class="overlay-meta" id="overlay-meta"></p>
        <div class="video-pane">
          <img class="video-stream" id="video-stream" alt="Live camera stream" />
          <span class="video-live" id="video-live" hidden>● LIVE</span>
          <p class="video-error" id="video-error" data-testid="video-error" hidden></p>
        </div>
        <h1 class="overlay-title" id="overlay-title"></h1>
      </div>
    </div>
  </div>
</template>
