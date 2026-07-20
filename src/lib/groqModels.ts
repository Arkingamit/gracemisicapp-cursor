/**
 * Groq chat models currently offered for Grace Copilot.
 * Keep in sync with https://console.groq.com/docs/models
 */
export const GROQ_CHAT_MODEL_PRESETS = [
  {
    id: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B (fast)',
  },
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B (strong)',
  },
  {
    id: 'qwen/qwen3.6-27b',
    label: 'Qwen 3.6 27B',
  },
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
  },
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
  },
] as const;

export const DEFAULT_GROQ_CHAT_MODEL = 'openai/gpt-oss-20b';

/** Old / decommissioned Groq model IDs → current replacements */
const DECOMMISSIONED_GROQ_MODELS: Record<string, string> = {
  'qwen-2.5-32b': 'qwen/qwen3.6-27b',
  'qwen-2.5-coder-32b': 'openai/gpt-oss-120b',
  'qwen-qwq-32b': 'qwen/qwen3.6-27b',
  'qwen/qwen3-32b': 'openai/gpt-oss-120b',
  'gemma2-9b-it': 'openai/gpt-oss-20b',
  'gemma-7b-it': 'openai/gpt-oss-20b',
  'deepseek-r1-distill-llama-70b': 'openai/gpt-oss-120b',
  'deepseek-r1-distill-qwen-32b': 'qwen/qwen3.6-27b',
  'deepseek-r1-distill-llama-70b-specdec': 'openai/gpt-oss-120b',
  'mixtral-8x7b-32768': 'openai/gpt-oss-120b',
  'mistral-saba-24b': 'openai/gpt-oss-120b',
  'llama3-70b-8192': 'llama-3.3-70b-versatile',
  'llama3-8b-8192': 'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile': 'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec': 'llama-3.3-70b-versatile',
  'llama3-groq-8b-8192-tool-use-preview': 'openai/gpt-oss-20b',
  'llama3-groq-70b-8192-tool-use-preview': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'openai/gpt-oss-120b',
  'moonshotai/kimi-k2-instruct': 'openai/gpt-oss-120b',
  'moonshotai/kimi-k2-instruct-0905': 'openai/gpt-oss-120b',
};

/**
 * Resolve the model ID to send to Groq.
 * Remaps decommissioned IDs so old admin settings keep working.
 */
export function resolveGroqChatModel(modelId?: string | null): string {
  const raw = (modelId || '').trim() || DEFAULT_GROQ_CHAT_MODEL;
  return DECOMMISSIONED_GROQ_MODELS[raw] || raw;
}
