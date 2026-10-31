import type { PromptSpec } from './prompts'
import { type ProviderCallOptions, extractJson } from './typhoon'

export const CLOUDFLARE_DEFAULT_MODEL = 'llama-3.1-8b-instruct'

export async function callCloudflare(
  prompt: PromptSpec,
  options: ProviderCallOptions & { accountId: string },
): Promise<unknown> {
  const url = `${options.baseUrl ?? `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/v1`}/chat/completions`
  const response = await options.fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({ model: options.model ?? CLOUDFLARE_DEFAULT_MODEL, temperature: 0.4, messages: [
      { role: 'system', content: prompt.system }, { role: 'user', content: prompt.user },
    ] }),
    signal: options.signal,
  })
  if (!response.ok) throw new Error(`Cloudflare ตอบกลับมาเป็นสถานะ ${response.status}`)
  const payload = (await response.json()) as { result?: { response?: string }; choices?: Array<{ message?: { content?: string } }> }
  const content = payload.result?.response ?? payload.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content) throw new Error('Cloudflare ตอบกลับมาโดยไม่มีเนื้อหา')
  return extractJson(content)
}
