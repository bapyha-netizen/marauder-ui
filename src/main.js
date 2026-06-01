import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import './assets/style.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}
