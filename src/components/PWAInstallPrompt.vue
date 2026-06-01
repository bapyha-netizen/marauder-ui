<script setup>
import { ref, onMounted } from 'vue'

const showPrompt = ref(false)
const deferredPrompt = ref(null)

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    showPrompt.value = true
  })
  window.addEventListener('appinstalled', () => {
    showPrompt.value = false
    deferredPrompt.value = null
  })
})

const install = async () => {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  await deferredPrompt.value.userChoice
  showPrompt.value = false
  deferredPrompt.value = null
}

const dismiss = () => {
  showPrompt.value = false
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showPrompt"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
      <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 flex items-center space-x-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-black">M</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-100">Install Marauder UI</div>
          <div class="text-[11px] text-slate-400">Add to home screen for offline access & full-screen mode</div>
        </div>
        <button @click="install" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Install</button>
        <button @click="dismiss" class="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200">✕</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
