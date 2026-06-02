import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { getCommandMeta, SEVERITY, SEVERITY_META } from '../commandMeta'

describe('commandMeta', () => {
  it('classifies known commands', () => {
    expect(getCommandMeta('scanall').severity).toBe(SEVERITY.INFO)
    expect(getCommandMeta('attack -t deauth').severity).toBe(SEVERITY.CRITICAL)
    expect(getCommandMeta('attack -t deauth').destructive).toBe(true)
    expect(getCommandMeta('blespam -t all').destructive).toBe(true)
    expect(getCommandMeta('reboot').needsConfirm).toBe(true)
  })

  it('infers severity from prefix for unknown commands', () => {
    expect(getCommandMeta('attack -t custom').severity).toBe(SEVERITY.CRITICAL)
    expect(getCommandMeta('blespam -t custom').destructive).toBe(true)
    expect(getCommandMeta('sniffbt -t custom').severity).toBe(SEVERITY.INFO)
  })

  it('has severity meta for all levels', () => {
    for (const sev of Object.values(SEVERITY)) {
      expect(SEVERITY_META[sev]).toBeDefined()
      expect(SEVERITY_META[sev].label).toBeTruthy()
      expect(SEVERITY_META[sev].color).toBeTruthy()
    }
  })

  it('marks dangerous commands as destructive', () => {
    expect(getCommandMeta('attack -t deauth').destructive).toBe(true)
    expect(getCommandMeta('attack -t beacon -r').destructive).toBe(true)
    expect(getCommandMeta('blespam -t all').destructive).toBe(true)
    expect(getCommandMeta('evilportal -c start').destructive).toBe(true)
    expect(getCommandMeta('karma -p 0').destructive).toBe(true)
    expect(getCommandMeta('clearlist -a').destructive).toBe(true)
  })

  it('marks needsTarget for selection-required attacks', () => {
    expect(getCommandMeta('attack -t deauth').needsTarget).toBe(true)
    expect(getCommandMeta('attack -t deauth -c').needsTarget).toBe(true)
    expect(getCommandMeta('attack -t beacon -a').needsTarget).toBe(true)
    expect(getCommandMeta('attack -t probe').needsTarget).toBe(true)
  })

  it('classifies info commands as low severity', () => {
    expect(getCommandMeta('list -a').severity).toBe(SEVERITY.INFO)
    expect(getCommandMeta('info').severity).toBe(SEVERITY.INFO)
    expect(getCommandMeta('scanall').severity).toBe(SEVERITY.INFO)
  })
})
