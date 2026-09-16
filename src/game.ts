export type Application = {
  name: string
  email: string
  pitch: string
}

export type Stage = 'applying' | 'offer' | 'hired'

export type GameState = {
  stage: Stage
  submissions: number
  company: string | null
  lastResult: 'rejected' | null
}

export type GameAction =
  | { type: 'submit'; roll: number; companyIndex: number }
  | { type: 'accept' }
  | { type: 'reset' }
  | { type: 'dev-jump'; stage: Stage }

export const sampleApplication: Application = {
  name: 'Alex Vibe',
  email: 'alex@example.com',
  pitch: 'I turn prompts into products before the stand-up ends.',
}

export const companies: readonly string[] = [
  'Prompt & Circumstance',
  'Ship It Labs',
  'The Merge Conflict',
  'Copilot & Chill',
  'Definitely Not a Startup',
]

export const initialGame: GameState = {
  stage: 'applying',
  submissions: 0,
  company: null,
  lastResult: null,
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'submit': {
      if (state.stage !== 'applying') {
        return state
      }

      const company =
        Number.isInteger(action.companyIndex) &&
        action.companyIndex >= 0 &&
        action.companyIndex < companies.length
          ? companies[action.companyIndex] ?? null
          : null
      const offered = action.roll < 0.01 && company !== null

      return {
        ...state,
        stage: offered ? 'offer' : 'applying',
        submissions: state.submissions + 1,
        company: offered ? company : null,
        lastResult: offered ? null : 'rejected',
      }
    }

    case 'accept':
      return state.stage === 'offer'
        ? { ...state, stage: 'hired' }
        : state

    case 'reset':
      return {
        stage: 'applying',
        submissions: 0,
        company: null,
        lastResult: null,
      }

    case 'dev-jump':
      if (action.stage === 'applying') {
        return { ...state, stage: 'applying', company: null, lastResult: null }
      }

      return {
        ...state,
        stage: action.stage,
        company:
          state.company !== null && companies.includes(state.company)
            ? state.company
            : companies[0] ?? null,
        lastResult: null,
      }
  }
}

