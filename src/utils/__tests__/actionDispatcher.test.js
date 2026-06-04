import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSerialSendCommand = vi.fn().mockResolvedValue(true)
const mockSerialSendAndWait = vi.fn().mockResolvedValue()
let mockTerminalArray = []

const serialStoreMock = {
  get sendCommand() { return mockSerialSendCommand },
  get sendAndWait() { return mockSerialSendAndWait },
  get terminalOutput() { return mockTerminalArray }
}

vi.mock('../../stores/serialStore', () => ({
  useSerialStore: () => serialStoreMock
}))

import { canRun, getPrereqState, shouldConfirm, clearActions, actions, runningAction, runAction, removeAction, getActiveCount, listRunning, isActionRunning } from '../actionDispatcher'
import { useApStore } from '../../stores/apStore'
import { useBleStore } from '../../stores/bleStore'
import { SEVERITY } from '../../services/commandMeta'

describe('actionDispatcher - prereqs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSerialSendCommand.mockClear()
    mockSerialSendAndWait.mockClear()
    mockTerminalArray = []
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

describe('actionDispatcher - runAction (execute path)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSerialSendCommand.mockReset()
    mockSerialSendAndWait.mockReset()
    mockSerialSendCommand.mockResolvedValue(true)
    mockSerialSendAndWait.mockResolvedValue()
    mockTerminalArray = []
    clearActions()
  })

  afterEach(() => {
    clearActions()
    mockTerminalArray = []
  })

  it('calls sendAndWait for non-scan/sniff commands', async () => {
    await runAction({ cmd: 'list -a', label: 'List APs' })
    expect(mockSerialSendCommand).not.toHaveBeenCalled()
    expect(mockSerialSendAndWait).toHaveBeenCalledWith('list -a', 3000)
  })

  it('calls sendCommand for scan commands', async () => {
    await runAction({ cmd: 'scanall', label: 'Scan' })
    expect(mockSerialSendCommand).toHaveBeenCalledWith('scanall')
    expect(mockSerialSendAndWait).not.toHaveBeenCalled()
  })

  it('calls sendCommand for sniff commands', async () => {
    await runAction({ cmd: 'sniffbt', label: 'Sniff BLE' })
    expect(mockSerialSendCommand).toHaveBeenCalledWith('sniffbt')
  })

  it('transitions action status from running to ok on success', async () => {
    expect(runningAction.value).toBe(null)
    const result = await runAction({ cmd: 'list -a', label: 'List APs' })
    expect(result.ok).toBe(true)
    expect(runningAction.value).toBe(null)
    expect(actions.value.length).toBe(1)
    expect(actions.value[0].status).toBe('ok')
    expect(actions.value[0].cmd).toBe('list -a')
    expect(actions.value[0].label).toBe('List APs')
  })

  it('transitions to error when output contains error keyword', async () => {
    mockSerialSendAndWait.mockImplementation(() => {
      mockTerminalArray = [{ text: 'error: something failed', cls: 'text-red-500' }]
      return Promise.resolve()
    })
    const result = await runAction({ cmd: 'list -a', label: 'List APs' })
    expect(actions.value[0].status).toBe('error')
    expect(result.ok).toBe(false)
  })

  it('transitions to error when sendAndWait rejects', async () => {
    mockSerialSendAndWait.mockRejectedValue(new Error('timeout'))
    const result = await runAction({ cmd: 'list -a', label: 'List APs' })
    expect(actions.value[0].status).toBe('error')
    expect(actions.value[0].result).toContain('timeout')
    expect(result.ok).toBe(false)
  })

  it('sets result text to "OK (no output)" when no terminal output arrives', async () => {
    const result = await runAction({ cmd: 'list -a', label: 'List APs' })
    expect(actions.value[0].result).toBe('OK (no output)')
    expect(result.ok).toBe(true)
  })

  it('throws PREREQ_FAILED error when prereq fails', async () => {
    await expect(runAction({ cmd: 'attack -t deauth', label: 'Deauth' }))
      .rejects.toMatchObject({ code: 'PREREQ_FAILED' })
    expect(mockSerialSendAndWait).not.toHaveBeenCalled()
    expect(mockSerialSendCommand).not.toHaveBeenCalled()
  })

  it('returns needsConfirm when shouldConfirm is true and options.confirm !== false', async () => {
    const result = await runAction({ cmd: 'reboot', label: 'Reboot' })
    expect(result.needsConfirm).toBe(true)
    expect(mockSerialSendAndWait).not.toHaveBeenCalled()
  })

  it('skips confirm when options.confirm is false', async () => {
    await runAction({ cmd: 'reboot', label: 'Reboot', options: { confirm: false } })
    expect(mockSerialSendAndWait).toHaveBeenCalledWith('reboot', 3000)
  })

  it('throws when cmd is empty', async () => {
    await expect(runAction({ cmd: '' })).rejects.toThrow(/No command specified/)
  })

  it('records the icon, target, severity from meta', async () => {
    const apStore = useApStore()
    apStore.updateOrAddAP({ bssid: 'AA:BB:CC:DD:EE:FF', index: 0, rssi: -50, channel: 6 })
    apStore.updateAP(0, { isSelected: true })
    await runAction({
      cmd: 'attack -t deauth',
      label: 'Deauth',
      icon: '⚡',
      target: 'AA:BB:CC:DD:EE:FF',
      options: { confirm: false }
    })
    const act = actions.value[0]
    expect(act.icon).toBe('⚡')
    expect(act.target).toBe('AA:BB:CC:DD:EE:FF')
    expect(act.severity).toBe(SEVERITY.CRITICAL)
    expect(act.destructive).toBe(true)
    expect(act.category).toBe('attack')
  })

  it('falls back to label=cmd when label not provided', async () => {
    await runAction({ cmd: 'list -a' })
    expect(actions.value[0].label).toBe('list -a')
  })

  it('removes the action via removeAction', async () => {
    await runAction({ cmd: 'list -a', label: 'List APs' })
    const id = actions.value[0].id
    removeAction(id)
    expect(actions.value.length).toBe(0)
  })

  it('caps action history at 50 entries', async () => {
    mockSerialSendAndWait.mockResolvedValue()
    for (let i = 0; i < 55; i++) {
      await runAction({ cmd: 'info', label: `L${i}` })
    }
    expect(actions.value.length).toBe(50)
  }, 30000)

  it('listRunning returns only running actions', async () => {
    let resolve
    mockSerialSendAndWait.mockImplementation(() => new Promise(r => { resolve = r }))
    const p = runAction({ cmd: 'list -a', label: 'L' })
    await new Promise(r => setTimeout(r, 10))
    expect(listRunning().length).toBe(1)
    expect(getActiveCount()).toBe(1)
    expect(isActionRunning()).toBe(true)
    resolve()
    await p
    expect(listRunning().length).toBe(0)
    expect(isActionRunning()).toBe(false)
  })

  it('clearActions empties history and running action', async () => {
    clearActions()
    await runAction({ cmd: 'info', label: 'L' })
    expect(actions.value.length).toBe(1)
    clearActions()
    expect(actions.value.length).toBe(0)
    expect(runningAction.value).toBe(null)
  })

  it('captures terminal output produced after the command fires', async () => {
    mockSerialSendAndWait.mockImplementation(async () => {
      mockTerminalArray.push({ text: 'Connected', cls: 'text-emerald-400' })
      mockTerminalArray.push({ text: 'AP list:', cls: 'text-slate-300' })
    })
    await runAction({ cmd: 'list -a', label: 'List APs' })
    const act = actions.value[0]
    expect(act.result).toContain('Connected')
    expect(act.result).toContain('AP list:')
  })
})
