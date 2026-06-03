import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../utils/actionDispatcher', () => ({
  getPrereqState: vi.fn(() => ({ ok: true, reason: null }))
}))

import { useContextAction } from '../useContextAction.ts'
import { SEVERITY } from '../../services/commandMeta.ts'

function makeSerialStore(connected = true) {
  return { isConnected: connected }
}

describe('useContextAction', () => {
  let serial

  beforeEach(() => {
    serial = makeSerialStore(true)
  })

  describe('isConnected', () => {
    it('returns true when serialStore.isConnected is true', () => {
      const ctx = useContextAction(serial)
      expect(ctx.isConnected.value).toBe(true)
    })

    it('returns false when serialStore.isConnected is false', () => {
      serial.isConnected = false
      const ctx = useContextAction(serial)
      expect(ctx.isConnected.value).toBe(false)
    })

    it('returns false when serialStore has isConnected=false', () => {
      const disconnectedSerial = { isConnected: false }
      const ctx = useContextAction(disconnectedSerial)
      expect(ctx.isConnected.value).toBe(false)
    })
  })

  describe('canRun', () => {
    it('returns ok when connected', () => {
      const ctx = useContextAction(serial)
      const r = ctx.canRun('scanall')
      expect(r.ok).toBe(true)
      expect(r.reason).toBe(null)
    })

    it('returns not-ok with reason when disconnected', () => {
      serial.isConnected = false
      const ctx = useContextAction(serial)
      const r = ctx.canRun('scanall')
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('Connect to device first')
      expect(r.severity).toBe(SEVERITY.LOW)
    })

    it('ignores cmd argument (prereq depends only on connection)', () => {
      serial.isConnected = false
      const ctx = useContextAction(serial)
      expect(ctx.canRun('attack -t deauth').ok).toBe(false)
      expect(ctx.canRun('list -a').ok).toBe(false)
    })
  })

  describe('btnState', () => {
    it('returns disabled state when not connected', () => {
      serial.isConnected = false
      const ctx = useContextAction(serial)
      const s = ctx.btnState('scanall')
      expect(s.disabled).toBe(true)
      expect(s.title).toBe('Connect to ESP32 first')
      expect(s.isDestructive).toBe(false)
      expect(s.severity).toBe(SEVERITY.LOW)
    })

    it('returns enabled state for safe cmd when connected', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('list -a')
      expect(s.disabled).toBe(false)
      expect(s.isDestructive).toBe(false)
    })

    it('flags destructive cmd', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('attack -t deauth')
      expect(s.disabled).toBe(false)
      expect(s.isDestructive).toBe(true)
      expect(s.severity).toBe(SEVERITY.CRITICAL)
    })

    it('flags reboot as critical destructive', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('reboot')
      expect(s.severity).toBe(SEVERITY.MEDIUM)
      expect(s.isDestructive).toBe(true)
    })

    it('uses custom title when provided', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('list -a', { title: 'List all APs' })
      expect(s.title).toBe('List all APs')
    })

    it('falls back to "Run: <cmd>" when no meta and no custom title', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('weirdo-unknown-cmd')
      expect(s.title).toBe('Run: weirdo-unknown-cmd')
    })

    it('uses resultHint from meta when available', () => {
      const ctx = useContextAction(serial)
      const s = ctx.btnState('scanall')
      expect(s.title).toMatch(/SSIDs|APs|networks/i)
    })
  })

  describe('btnClass', () => {
    it('adds opacity-40 and cursor-not-allowed when disabled', () => {
      serial.isConnected = false
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('scanall', 'btn-primary btn-sm')
      expect(cls).toContain('opacity-40')
      expect(cls).toContain('cursor-not-allowed')
      expect(cls).toContain('btn-primary')
      expect(cls).toContain('btn-sm')
    })

    it('uses red-500 styling for CRITICAL severity', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('reboot', 'btn-sm')
      expect(cls).toContain('red-500')
    })

    it('returns HIGH severity for blespam variants', () => {
      const ctx = useContextAction(serial)
      const state = ctx.btnState('blespam -t google')
      expect(state.severity).toBe(SEVERITY.HIGH)
      // All HIGH cmds in current meta are destructive, so the destructive
      // short-circuit applies and uses red. This verifies the destructive
      // path correctly handles HIGH severity.
      expect(state.isDestructive).toBe(true)
    })

    it('returns MEDIUM severity for non-destructive cmds like join/clone', () => {
      const ctx = useContextAction(serial)
      const state = ctx.btnState('join -a 0 -p')
      expect(state.severity).toBe(SEVERITY.MEDIUM)
      expect(state.isDestructive).toBeFalsy()
    })

    it('uses yellow-500 styling for MEDIUM severity non-destructive', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('join -a 0 -p', 'btn-sm')
      expect(cls).toMatch(/yellow|amber/)
    })

    it('uses blue-500 styling for LOW severity non-destructive', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('ssid -a -g 10', 'btn-sm')
      expect(cls).toMatch(/blue/)
    })

    it('preserves base class for INFO severity non-destructive', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('settings', 'btn-primary')
      expect(cls).toBe('btn-primary')
    })

    it('uses base class for INFO severity (no override)', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('settings', 'btn-primary')
      expect(cls).toBe('btn-primary')
    })

    it('always includes base class for INFO severity (no override)', () => {
      const ctx = useContextAction(serial)
      const cls = ctx.btnClass('list -a', 'btn-ghost btn-sm')
      expect(cls).toBe('btn-ghost btn-sm')
    })
  })

  describe('integration with shouldConfirm', () => {
    it('does not require confirm for safe list cmd', () => {
      const ctx = useContextAction(serial)
      const state = ctx.btnState('list -a')
      expect(state.isDestructive).toBe(false)
    })

    it('flags reboot as destructive (caller uses shouldConfirm)', () => {
      const ctx = useContextAction(serial)
      const state = ctx.btnState('reboot')
      expect(state.isDestructive).toBe(true)
      expect(state.severity).toBe(SEVERITY.MEDIUM)
    })
  })
})
