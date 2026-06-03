/**
 * Firmware profile registry.
 *
 * Each profile exposes:
 *   - id: stable identifier (e.g. "marauder-v1")
 *   - description: human-readable summary
 *   - DISPATCH: { firstCharCode: [parserFn, ...] }
 *   - FALLBACK_PARSERS: [parserFn, ...]
 *   - resetState(): clear transient state
 *
 * The active profile is selected at runtime. If the firmware is later
 * updated and a new grammar is published, add a new profile module
 * under `./firmwareProfiles/` and register it here.
 */

import * as v1 from './marauderV1.js'

const _registry = new Map()
const _active = { current: null }

function register(profile) {
  if (!profile || !profile.id) return
  _registry.set(profile.id, profile)
  if (!_active.current) _active.current = profile.id
}

function get(id) {
  return _registry.get(id)
}

function setActive(id) {
  if (_registry.has(id)) _active.current = id
}

function active() {
  return _registry.get(_active.current)
}

function list() {
  return Array.from(_registry.values()).map(p => ({ id: p.id, description: p.description }))
}

register(v1)

export const firmwareProfiles = {
  register,
  get,
  setActive,
  active,
  list
}
