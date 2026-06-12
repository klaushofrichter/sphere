import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { authEnabled, initAuth } from './auth';

if (!authEnabled) {
  document.getElementById('app')!.innerHTML =
    '<div class="login"><h1 class="login-title">CONFIGURATION ERROR</h1>' +
    '<p class="login-sub" data-testid="config-error">VITE_PROXY_URL and VITE_EEN_CLIENT_ID must be set at build time.</p></div>';
  throw new Error('Auth not configured: VITE_PROXY_URL / VITE_EEN_CLIENT_ID missing');
}

const app = createApp(App);
app.use(createPinia()); // must precede initEenToolkit (toolkit requirement)
initAuth();
app.mount('#app');
