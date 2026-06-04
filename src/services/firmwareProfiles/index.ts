import type { FirmwareProfile } from '../../types/parser'
import * as v1 from './marauderV1'

const _registry = new Map<string, FirmwareProfile>()
const _active = { current: null as string | null }
const _MIN_VERSION = 1

function _validateProfile(profile: FirmwareProfile): void {
  if (!profile || !profile.id) {
    throw new Error('FirmwareProfile: missing id')
  }
  if (!profile.DISPATCH || !profile.FALLBACK_PARSERS) {
    throw new Error(`FirmwareProfile ${profile.id}: missing DISPATCH or FALLBACK_PARSERS`)
  }
  if (typeof profile.resetState !== 'function') {
    throw new Error(`FirmwareProfile ${profile.id}: missing resetState`)
  }
  const ver = profile.version
  if (typeof ver !== 'number' || ver < _MIN_VERSION) {
    throw new Error(`FirmwareProfile ${profile.id}: invalid version (got ${ver}, need >= ${_MIN_VERSION})`)
  }
}

function register(profile: FirmwareProfile): void {
  _validateProfile(profile)
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

const marauderV1Profile: FirmwareProfile = {
  name: 'marauderV1',
  id: v1.META.id,
  description: v1.META.description,
  version: 1,
  DISPATCH: v1.DISPATCH,
  FALLBACK_PARSERS: v1.FALLBACK_PARSERS,
  resetState: v1.resetState
}
register(marauderV1Profile)

export const firmwareProfiles = { get, setActive, active, list }
