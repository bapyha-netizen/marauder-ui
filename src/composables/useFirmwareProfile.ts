import { ref, computed, watch } from 'vue'
import { setActiveProfile as setParserProfile, registerProfile as registerParserProfile } from '../services/parserEngine'
import type { FirmwareProfile } from '../types/parser'

const _profiles = new Map<string, FirmwareProfile>()
const _activeProfileName = ref<string>('marauderV1')

import { marauderV1 } from '../services/firmwareProfiles/marauderV1'
_profiles.set('marauderV1', marauderV1)

function _switchParserProfile(name: string) {
  try {
    setParserProfile(name)
  } catch {
    // parser engine may not be initialized yet
  }
}

// Register default profile with parser
try {
  registerParserProfile(marauderV1)
} catch {
  // parser engine may not be initialized yet
}

export function useFirmwareProfile() {
  const activeProfile = computed(() => _profiles.get(_activeProfileName.value))

  function setActiveProfile(profileName: string) {
    if (!_profiles.has(profileName)) {
      throw new Error(`Unknown firmware profile: ${profileName}`)
    }
    _activeProfileName.value = profileName
    _switchParserProfile(profileName)
  }

  function registerProfile(profile: FirmwareProfile) {
    _profiles.set(profile.name, profile)
    registerParserProfile(profile)
  }

  function getAvailableProfiles() {
    return Array.from(_profiles.keys())
  }

  watch(_activeProfileName, (newProfile) => {
    _switchParserProfile(newProfile)
  }, { immediate: true })

  return {
    activeProfileName: _activeProfileName,
    activeProfile,
    setActiveProfile,
    registerProfile,
    getAvailableProfiles
  }
}