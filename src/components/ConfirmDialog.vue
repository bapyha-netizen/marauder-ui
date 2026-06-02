<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @keydown.esc.stop="onCancel"
        @click.self="onCancel"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="titleId">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative bg-slate-800 border-2 rounded-2xl shadow-2xl max-w-md w-full p-5"
          :class="borderClass">
          <div class="flex items-start space-x-3 mb-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl"
              :class="iconBgClass">
              {{ icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 :id="titleId" class="text-sm font-semibold text-slate-100">{{ title }}</h3>
              <div class="mt-1 text-xs text-slate-400 space-y-1">
                <p v-for="(line, i) in bodyLines" :key="i">{{ line }}</p>
              </div>
            </div>
          </div>
          <div v-if="cmd" class="mb-4 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Command</div>
            <div class="font-mono text-[11px] text-amber-300 break-all">{{ cmd }}</div>
            <div v-if="target" class="font-mono text-[10px] text-slate-500 mt-1 break-all">Target: {{ target }}</div>
          </div>
          <div class="flex items-center justify-end space-x-2">
            <button ref="cancelBtn" @click="onCancel"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400">
              {{ cancelLabel }}
            </button>
            <button @click="onConfirm"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2"
              :class="confirmClass">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { SEVERITY_META, SEVERITY } from '../services/commandMeta'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm action' },
  body: { type: [String, Array], default: '' },
  cmd: { type: String, default: '' },
  target: { type: String, default: '' },
  icon: { type: String, default: '⚠' },
  severity: { type: String, default: SEVERITY.HIGH },
  confirmLabel: { type: String, default: 'Run' },
  cancelLabel: { type: String, default: 'Cancel' }
})

const emit = defineEmits(['confirm', 'cancel'])
const cancelBtn = ref(null)
const titleId = `confirm-title-${Math.random().toString(36).slice(2, 8)}`

const bodyLines = computed(() => {
  if (Array.isArray(props.body)) return props.body
  return [props.body]
})

const meta = computed(() => SEVERITY_META[props.severity] || SEVERITY_META[SEVERITY.HIGH])

const borderClass = computed(() => {
  switch (props.severity) {
    case SEVERITY.CRITICAL: return 'border-red-500/70'
    case SEVERITY.HIGH:     return 'border-orange-500/70'
    case SEVERITY.MEDIUM:   return 'border-yellow-500/70'
    default:                return 'border-slate-700'
  }
})

const iconBgClass = computed(() => {
  switch (props.severity) {
    case SEVERITY.CRITICAL: return 'bg-red-500/20 text-red-300'
    case SEVERITY.HIGH:     return 'bg-orange-500/20 text-orange-300'
    case SEVERITY.MEDIUM:   return 'bg-yellow-500/20 text-yellow-300'
    default:                return 'bg-slate-700 text-slate-300'
  }
})

const confirmClass = computed(() => {
  switch (props.severity) {
    case SEVERITY.CRITICAL: return 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-400'
    case SEVERITY.HIGH:     return 'bg-orange-600 hover:bg-orange-500 text-white focus:ring-orange-400'
    case SEVERITY.MEDIUM:   return 'bg-yellow-600 hover:bg-yellow-500 text-white focus:ring-yellow-400'
    default:                return 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-400'
  }
})

watch(() => props.show, async (s) => {
  if (s) {
    await nextTick()
    cancelBtn.value?.focus()
  }
})

const onConfirm = () => emit('confirm')
const onCancel = () => emit('cancel')
</script>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
.modal-leave-to > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
</style>
