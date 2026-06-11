import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { authEnabled, initAuth } from './auth';

const app = createApp(App);
app.use(createPinia()); // must precede initEenToolkit (toolkit requirement)
if (authEnabled) initAuth();
app.mount('#app');
