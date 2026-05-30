<template>
  <div v-if="isMobileDevice"
    class="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-6">
    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-8 max-w-sm w-full text-center">
      <div class="text-3xl mb-4">💻</div>
      <h1 class="text-lg font-bold text-slate-100 mb-3">Desktop Only</h1>
      <p class="text-sm text-slate-400 mb-4 leading-relaxed">
        This application requires Web Serial API — available only on desktop Chrome or Edge.
      </p>
      <p class="text-xs text-slate-500">Open from a desktop browser.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isMobileDevice = ref(false)

const checkMobile = () => {
  const ua = navigator.userAgent
  const isIPad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  const isMobileUA = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isNarrowScreen = window.innerWidth <= 768
  const hasWebSerial = 'serial' in navigator
  isMobileDevice.value = (isMobileUA || isIPad || isNarrowScreen) && !hasWebSerial
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('orientationchange', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('orientationchange', checkMobile)
})
</script>