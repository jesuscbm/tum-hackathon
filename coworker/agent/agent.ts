import { defineAgent } from 'eve';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createHash } from 'node:crypto';
// OpenCode Go rejects requests without a stable per-conversation x-opencode-session header.
// A conversation's opening messages never change, so their hash identifies it across turns.
const opencodeFetch: typeof fetch = (input, init) => {
 const headers = new Headers(init?.headers);
 try {
  const opening = JSON.stringify(JSON.parse(String(init?.body)).messages?.slice(0, 2));
  headers.set('x-opencode-session', createHash('sha256').update(opening).digest('hex').slice(0, 32));
 } catch {}
 headers.set('user-agent', 'lokal-coworker');
 return fetch(input, {...init, headers});
};
const provider = createOpenAICompatible({name:'zai',baseURL:process.env.ZAI_BASE_URL!,apiKey:process.env.ZAI_API_KEY!,fetch:process.env.ZAI_BASE_URL?.includes('opencode.ai')?opencodeFetch:undefined});
const contextWindow = process.env.ZAI_CONTEXT_WINDOW_TOKENS?.trim();
const modelContextWindowTokens = contextWindow ? Number(contextWindow) : undefined;
if (modelContextWindowTokens !== undefined && (!Number.isSafeInteger(modelContextWindowTokens) || modelContextWindowTokens <= 0)) {
 throw new Error('ZAI_CONTEXT_WINDOW_TOKENS must be a positive integer');
}
export default defineAgent({model:provider.chatModel(process.env.ZAI_MODEL!),modelContextWindowTokens,defaultTools:false});
