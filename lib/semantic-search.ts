import { createHash } from 'node:crypto';
import { AIError, reserve, transact } from './ai-budget';

export type EmbeddingRecord = { model: 'text-embedding-3-small'; fingerprint: string; vector: number[] };
export type EmbeddingCache = { get(key: string): Promise<EmbeddingRecord | null>; put(key: string, record: EmbeddingRecord): Promise<void> };
const model = 'text-embedding-3-small' as const;
const rate = 0.02 / 1_000_000;
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length || [...a, ...b].some(n => !Number.isFinite(n))) return 0;
  const dot = a.reduce((sum, n, i) => sum + n * b[i], 0), norm = Math.sqrt(a.reduce((sum, n) => sum + n * n, 0) * b.reduce((sum, n) => sum + n * n, 0));
  return norm ? dot / norm : 0;
}
/** Shared cache is for definition metadata only. Private query text never enters it. */
export async function embedText(text: string, options: { session: string; cache?: EmbeddingCache; publicDefinition?: { id: string; version: number } }): Promise<EmbeddingRecord> {
  if (!text.trim() || text.length > 12000) throw new AIError(413, 'Embedding text must contain 1–12000 characters.');
  if (!process.env.OPENAI_API_KEY) throw new AIError(503, 'Semantic search requires a server OpenAI key.');
  const fingerprint = createHash('sha256').update(model + text).digest('hex');
  const cacheKey = options.publicDefinition ? `${options.publicDefinition.id}@${options.publicDefinition.version}:${fingerprint}` : undefined;
  if (cacheKey && options.cache) { const saved = await options.cache.get(cacheKey); if (saved?.fingerprint === fingerprint && saved.model === model && saved.vector.length && saved.vector.every(Number.isFinite)) return saved; }
  // A UTF-8 byte bound deliberately overestimates tokenizer cost, including Hebrew text.
  const reservation = Buffer.byteLength(text) * rate;
  const requestKey = createHash('sha256').update(options.session + model + fingerprint).digest('hex');
  const cached = await transact(ledger => reserve(ledger, requestKey, reservation));
  if (cached) return cached as EmbeddingRecord;
  let usageCost: number | undefined;
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: text, dimensions: 256 }), signal: AbortSignal.timeout(20000), cache:'no-store' });
    if (!response.ok) { if ([400,401,403,429].includes(response.status)) usageCost = 0; throw new AIError(response.status === 429 ? 429 : 502, 'Semantic search provider is unavailable.'); }
    const data = await response.json();
    if (Number.isInteger(data.usage?.total_tokens) && data.usage.total_tokens >= 0) usageCost = data.usage.total_tokens * rate;
    const vector: unknown = data.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== 256 || vector.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw new AIError(502, 'Semantic search returned an invalid vector.');
    const record: EmbeddingRecord = { model, fingerprint, vector: vector as number[] };
    await transact(ledger => { ledger.spent = Math.max(0, ledger.spent + (usageCost ?? reservation) - reservation); ledger.entries[requestKey] = { at: Date.now(), cost: usageCost ?? reservation, result: record }; });
    if (cacheKey && options.cache) await options.cache.put(cacheKey, record);
    return record;
  } catch (error) {
    if (usageCost !== undefined) await transact(ledger => { if (ledger.entries[requestKey]?.result) return; ledger.spent = Math.max(0, ledger.spent + usageCost! - reservation); ledger.entries[requestKey] = { at: Date.now() - 585000, cost: usageCost! }; }).catch(() => {});
    if (error instanceof AIError) throw error;
    throw new AIError(503, 'Semantic search failed; no external action was performed.');
  }
}
export async function semanticScores(query: string, definitions: Array<{ id:string; version:number; name:string; description:string; capabilities:string[]; examples:string[]; scope?:string }>, session:string, cache?:EmbeddingCache): Promise<Record<string,number>> {
  if (!process.env.OPENAI_API_KEY) throw new AIError(503, 'Semantic search requires a server OpenAI key.');
  const documents = definitions.slice(0,32).map(definition => {
    const text = [definition.name, definition.description, ...definition.capabilities, ...definition.examples].join('\n').slice(0,12000);
    const fingerprint = createHash('sha256').update(model + text).digest('hex');
    return { definition, text, fingerprint, cacheKey:`${definition.id}@${definition.version}:${fingerprint}` };
  });
  const cached = new Map<string,EmbeddingRecord>();
  for (const document of documents) if (cache && document.definition.scope !== 'private') {
    const record = await cache.get(document.cacheKey);
    if (record?.model === model && record.fingerprint === document.fingerprint && record.vector.length === 256 && record.vector.every(Number.isFinite)) cached.set(document.cacheKey, record);
  }
  const missing = documents.filter(document => !cached.has(document.cacheKey));
  const input = [query, ...missing.map(document => document.text)];
  if (input.some(text => !text.trim() || text.length > 12000)) throw new AIError(413,'Embedding text must contain 1–12000 characters.');
  const reservation = input.reduce((sum,text) => sum + Buffer.byteLength(text),0) * rate;
  const requestKey = createHash('sha256').update(session + model + JSON.stringify(input)).digest('hex');
  const reserved = await transact(ledger => reserve(ledger,requestKey,reservation));
  let vectors: number[][];
  if (reserved) vectors = reserved as number[][];
  else {
    let usageCost: number | undefined;
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input,dimensions:256}),signal:AbortSignal.timeout(20000),cache:'no-store'});
      if (!response.ok) { if ([400,401,403,429].includes(response.status)) usageCost=0; throw new AIError(response.status===429?429:502,'Semantic search provider is unavailable.'); }
      const data = await response.json();
      if (Number.isInteger(data.usage?.total_tokens) && data.usage.total_tokens >= 0) usageCost=data.usage.total_tokens*rate;
      if (!Array.isArray(data.data) || data.data.length!==input.length) throw new AIError(502,'Invalid embedding response.');
      vectors = data.data.sort((a:{index:number},b:{index:number})=>a.index-b.index).map((item:{embedding:unknown})=>item.embedding);
      if (vectors.some(vector=>!Array.isArray(vector)||vector.length!==256||vector.some(value=>typeof value!=='number'||!Number.isFinite(value)))) throw new AIError(502,'Invalid embedding vector.');
      await transact(ledger=>{ledger.spent=Math.max(0,ledger.spent+(usageCost??reservation)-reservation);ledger.entries[requestKey]={at:Date.now(),cost:usageCost??reservation,result:vectors};});
    } catch(error) {
      if (usageCost!==undefined) await transact(ledger=>{if(ledger.entries[requestKey]?.result)return;ledger.spent=Math.max(0,ledger.spent+usageCost!-reservation);ledger.entries[requestKey]={at:Date.now()-585000,cost:usageCost!};}).catch(()=>{});
      if(error instanceof AIError)throw error;throw new AIError(503,'Semantic search failed.');
    }
  }
  for (const [index,document] of missing.entries()) {
    const record:EmbeddingRecord={model,fingerprint:document.fingerprint,vector:vectors[index+1]};
    cached.set(document.cacheKey,record);
    if(cache&&document.definition.scope!=='private')await cache.put(document.cacheKey,record);
  }
  return Object.fromEntries(documents.map(document=>[`${document.definition.id}@${document.definition.version}`,cosineSimilarity(vectors[0],cached.get(document.cacheKey)!.vector)]));
}
