<script setup lang="ts">
import { login } from '../auth';

defineProps<{ error?: string | null }>();
</script>

<template>
  <div class="login" data-testid="login-view">
    <h1 class="login-title">SPHERE GALLERY</h1>
    <p class="login-sub">Sign in to view the gallery.</p>
    <p v-if="error" class="login-error" data-testid="login-error">{{ error }}</p>
    <button class="login-button" data-testid="login-button" @click="login()">
      Sign in with Eagle Eye Networks
    </button>
  </div>
</template>
