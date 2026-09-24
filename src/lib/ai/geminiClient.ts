import type { AIResponse, ChatTurn } from './types'

// ---------------------------------------------------------------------------
// Minimal Google Gemini client (free tier friendly).
//
// Uses plain `generateContent` with structured JSON output (responseSchema),
// which is far more robust than native function-calling to build against —
// the model is *forced* to return our action schema as valid JSON.
//
// The API key lives only in this browser's localStorage (personal, local use).
// Because model ids change over time, we auto-detect a working free "flash"
// model via models.list if the configured one 404s, and cache the result.
// ---------------------------------------------------------------------------

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'
const KEY_STORAGE = 'chronos.ai.key'
const MODEL_STORAGE = 'chronos.ai.model'
const DEFAULT_MODEL = 'gemini-2.0-flash'

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}
export function setApiKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key.trim())
  } catch {
    /* ignore */
  }
}
export function hasApiKey(): boolean {
  return getApiKey().length > 0
}

function getModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}
function setModel(m: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE, m)
  } catch {
    /* ignore */
  }
}

// The strict schema the model must return.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    message: { type: 'STRING' },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: ['create_event', 'update_event', 'delete_event', 'move_event', 'navigate'],
          },
          eventId: { type: 'STRING' },
          title: { type: 'STRING' },
          start: { type: 'STRING' },
          end: { type: 'STRING' },
          allDay: { type: 'BOOLEAN' },
          location: { type: 'STRING' },
          description: { type: 'STRING' },
          calendar: { type: 'STRING' },
          recurrence: { type: 'STRING', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
          scope: { type: 'STRING', enum: ['this', 'following', 'all'] },
          view: { type: 'STRING', enum: ['day', 'week', 'month', 'year', 'agenda'] },
          date: { type: 'STRING' },
        },
        required: ['type'],
      },
    },
  },
  required: ['message', 'actions'],
}

async function findWorkingModel(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_ROOT}/models`, { headers: { 'x-goog-api-key': key } })
    if (!res.ok) return null
    const data = await res.json()
    const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models ?? []
    const usable = models
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
    // Prefer a plain "flash" text model (free tier), newest-looking first.
    const flash = usable
      .filter((n) => n.includes('flash') && !n.includes('image') && !n.includes('tts') && !n.includes('vision'))
      .sort()
      .reverse()
    return flash[0] ?? usable[0] ?? null
  } catch {
    return null
  }
}

export class GeminiError extends Error {}

async function callModel(model: string, key: string, body: unknown): Promise<Response> {
  return fetch(`${API_ROOT}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
}

/**
 * Send the system prompt + conversation and get back a parsed AIResponse.
 * Throws GeminiError with a friendly message on failure.
 */
export async function askGemini(systemPrompt: string, history: ChatTurn[]): Promise<AIResponse> {
  const key = getApiKey()
  if (!key) throw new GeminiError('No API key set.')

  const contents = history.map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.text }],
  }))

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  }

  let model = getModel()
  let res = await callModel(model, key, body)

  // If the configured model is gone (404) or invalid (400), auto-detect one.
  if (res.status === 404 || res.status === 400) {
    const detected = await findWorkingModel(key)
    if (detected && detected !== model) {
      model = detected
      setModel(model)
      res = await callModel(model, key, body)
    }
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    if (res.status === 400 && /API key/i.test(detail))
      throw new GeminiError('That API key was rejected. Double-check it in AI Studio.')
    if (res.status === 429)
      throw new GeminiError('Rate limit hit on the free tier — wait a moment and try again.')
    throw new GeminiError(detail || `Request failed (HTTP ${res.status}).`)
  }

  const data = await res.json()
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    const blocked = data?.promptFeedback?.blockReason
    throw new GeminiError(blocked ? `Request was blocked (${blocked}).` : 'Empty response from the model.')
  }

  try {
    const parsed = JSON.parse(text) as AIResponse
    if (!parsed.message) parsed.message = ''
    if (!Array.isArray(parsed.actions)) parsed.actions = []
    return parsed
  } catch {
    // Model returned prose instead of JSON — surface it as a plain reply.
    return { message: text, actions: [] }
  }
}
