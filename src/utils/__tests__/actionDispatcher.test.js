import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

const mockSerialSendCommand = vi.fn().mockResolvedValue(true)
const mockSerialSendAndWait = vi.fn().mockResolvedValue()
const mockTerminalOutput = ref([])

vi.mock('../../stores/serialStore', () => ({
  useSerialStore: () => ({
    sendCommand: mockSerialSendCommand,
    sendAndWait: mockSerialSendAndWait,
    terminalOutput: mockTerminalOutput
  })
}))

import { canRun, getPrereqState, shouldConfirm, clearActions, actions, runningAction } from '../actionDispatcher'
import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { SEVERITY } from '../../services/commandMeta'

describe('actionDispatcher - prereqs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSerialSendCommand.mockClear()
    mockSerialSendAndWait.mockClear()
    mockTerminalOutput.value = []
  })

  it('blocks attack -t deauth when no APs are selected', () => {
    const state = getPrereqState('attack -t deauth')
    expect(state.ok).toBe(false)
    expect(state.reason).toContain('target')
  })

  it('allows attack -t deauth when at least one AP is selected', () => {
    const apStore = useApStore()
    apStore.updateOrAddAP({ bssid: 'AA:BB:CC:DD:EE:FF', index: 0, rssi: -50, channel: 6 })
    apStore.updateAP(0, { isSelected: true })
    const state = getPrereqState('attack -t deauth')
    expect(state.ok).toBe(true)
  })

  it('allows scanall with no APs (will discover new ones)', () => {
    const state = getPrereqState('scanall')
    expect(state.ok).toBe(true)
  })

  it('requires confirm for critical commands', () => {
    expect(shouldConfirm('reboot')).toBe(true)
    expect(shouldConfirm('evilportal -c start')).toBe(true)
    expect(shouldConfirm('karma -p 0')).toBe(true)
    expect(shouldConfirm('update -s')).toBe(true)
  })

  it('does not require confirm for scan commands', () => {
    expect(shouldConfirm('scanall')).toBe(false)
    expect(shouldConfirm('list -a')).toBe(false)
  })

  it('canRun returns false when prereq fails', () => {
    expect(canRun('attack -t deauth')).toBe(false)
  })

  it('canRun returns true when prereq passes', () => {
    expect(canRun('scanall')).toBe(true)
  })
})
