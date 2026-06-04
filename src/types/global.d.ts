// Global window property declarations for firmware profile management
declare global {
  interface Window {
    __setActiveProfile?: (profileName: string) => void
    __registerProfile?: (profile: import('./parser').FirmwareProfile) => void
    __onProfileChange?: (profileName: string) => void
  }
}

export {}