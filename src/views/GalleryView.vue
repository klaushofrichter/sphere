<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { startGallery, destroyGallery } from '../galleryApp.js';

const root = ref(null);

onMounted(() => { startGallery(root.value); });
onUnmounted(() => { destroyGallery(); });
</script>

<template>
  <div>
    <div ref="root" class="gallery-canvas"></div>
    <div class="vignette"></div>
    <header class="hud">SPHERE GALLERY — POC</header>
    <div id="overlay" class="overlay" aria-hidden="true">
      <button class="overlay-close" id="overlay-close">Close</button>
      <div class="overlay-inner">
        <p class="overlay-client" id="overlay-client"></p>
        <h1 class="overlay-title" id="overlay-title"></h1>
        <p class="overlay-meta" id="overlay-meta"></p>
        <img class="overlay-img" id="overlay-img" alt="" />
      </div>
    </div>
  </div>
</template>
