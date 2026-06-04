import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/style.css'
import { t, tA } from './services/i18n'

const app = createApp(App)
app.config.globalProperties.$t = t
app.config.globalProperties.$tA = tA
app.use(createPinia())
app.mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  }).catch(e => console.warn('PWA registration failed:', e))
}
