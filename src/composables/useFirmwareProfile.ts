import { ref, computed, watch } from 'vue'
import { setActiveProfile, getActiveProfile, registerProfile } from '../services/parserEngine'
import type { FirmwareProfile } from '../types/parser'

// AR-03: Firmware profile management composable
const _profiles = new Map<string, FirmwareProfile>()
const _activeProfileName = ref<string>('marauderV1')

// Register default profiles
import { marauderV1 } from '../services/firmwareProfiles/marauderV1'
_profiles.set('marauderV1', marauderV1)

export function useFirmwareProfile() {
  const activeProfile = computed(() => _profiles.get(_activeProfileName.value))

  function setActiveProfile(profileName: string) {
    if (!_profiles.has(profileName)) {
      throw new Error(`Unknown firmware profile: ${profileName}`)
    }
    _activeProfileName.value = profileName
    // Update the global parser profile
    window.__setActiveProfile?.(profileName)
  }

  function registerProfile(profile: FirmwareProfile) {
    _profiles.set(profile.name, profile)
    // Also register with the parser engine
    window.__registerProfile?.(profile)
  }

  function getAvailableProfiles() {
    return Array.from(_profiles.keys())
  }

  // Watch for profile changes and notify the parser engine
  watch(_activeProfileName, (newProfile) => {
    if (window.__setActiveProfile) {
      window.__setActiveProfile(newProfile)
    }
  }, { immediate: true })

  return {
    activeProfileName: _activeProfileName,
    activeProfile,
    setActiveProfile,
    registerProfile,
    getAvailableProfiles
  }
}

// Initialize the global profile management
if (typeof window !== 'undefined') {
  window.__setActiveProfile = setActiveProfile
  window.__registerProfile = registerProfile
}