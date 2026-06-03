export interface CommandDef {
  cmd: string
  description: string
  category: string
  requiresTarget?: boolean
}

export interface Scenario {
  id: string
  name: string
  description: string
  steps: (string | { command: string; delay: number })[]
}
