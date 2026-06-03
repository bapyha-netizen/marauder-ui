import type { FirmwareProfile } from '../../types/parser'
import * as v1 from './marauderV1'

const _registry = new Map<string, FirmwareProfile>()
const _active = { current: null as string | null }

function register(profile: FirmwareProfile): void {
  if (!profile || !profile.id) return
  _registry.set(profile.id, profile)
  if (!_active.current) _active.current = profile.id
}

function get(id: string): FirmwareProfile | undefined {
  return _registry.get(id)
}

function setActive(id: string): void {
  if (_registry.has(id)) _active.current = id
}

function active(): FirmwareProfile | undefined {
  return _active.current ? _registry.get(_active.current) : undefined
}

function list(): { id: string; description: string }[] {
  return Array.from(_registry.values()).map(p => ({ id: p.id, description: p.description }))
}

register(v1 as unknown as FirmwareProfile)

export const firmwareProfiles = { register, get, setActive, active, list }
