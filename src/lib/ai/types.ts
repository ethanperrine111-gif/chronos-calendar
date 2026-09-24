// Shape of the JSON the model is required to return. Kept flat and simple so
// it maps cleanly onto Gemini's responseSchema (a subset of OpenAPI schema).

export type AIActionType =
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'move_event'
  | 'navigate'

export interface AIAction {
  type: AIActionType
  /** Target for update/delete/move — the instance id shown in context, or a title to match. */
  eventId?: string
  title?: string
  /** ISO datetimes the model computes from the provided "now". */
  start?: string
  end?: string
  allDay?: boolean
  location?: string
  description?: string
  /** Calendar name (matched case-insensitively; falls back to the primary calendar). */
  calendar?: string
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** For recurring targets. Defaults to "this". */
  scope?: 'this' | 'following' | 'all'
  /** navigate action. */
  view?: 'day' | 'week' | 'month' | 'year' | 'agenda'
  date?: string
}

export interface AIResponse {
  /** Friendly natural-language reply shown in the chat. */
  message: string
  actions: AIAction[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}
