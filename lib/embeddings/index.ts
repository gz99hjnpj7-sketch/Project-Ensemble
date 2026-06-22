import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const EMBED_MODEL = "gemini-embedding-001"; // 3072 dimensions with current Gemini surface for the test key
const EMBEDDING_DIM = 3072;
const MIN_SEMANTIC_SIMILARITY = 0.75; // raised for stricter matching to avoid unrelated markets (e.g. World Cup polluting politics)

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env for embeddings.");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(EMBEDDING_DIM).fill(0);
  }
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(text.trim());
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Failed to obtain embedding from Gemini");
  }
  return values;
}

export async function embedTexts(texts: string[], concurrency = 6): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);
  let index = 0;

  async function worker() {
    while (index < texts.length) {
      const i = index++;
      try {
        results[i] = await embedText(texts[i]);
      } catch (e) {
        results[i] = new Array(EMBEDDING_DIM).fill(0);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Semantic filtering: return true if this embedding is sufficiently close to at least one reference.
 */
export function passesSemanticFilter(
  marketEmbedding: number[],
  clusterEmbeddings: number[][]
): boolean {
  if (!marketEmbedding.length) return false;
  return clusterEmbeddings.some((ce) => cosineSimilarity(marketEmbedding, ce) >= MIN_SEMANTIC_SIMILARITY);
}

export { EMBEDDING_DIM };
export const MIN_SIM_THRESHOLD = MIN_SEMANTIC_SIMILARITY;

/**
 * Use a cheap Gemini model to turn a group of related market questions into
 * a clean event title + description for a new ForecastCluster.
 */
export async function synthesizeEventMeta(questions: string[]): Promise<{ title: string; description: string }> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are building a semantic forecast intelligence system.
Given the following related prediction market questions, produce:
- A short, neutral, specific event title (under 65 characters)
- A concise one-sentence description of the core future event or question being asked

Questions:
${questions.slice(0, 8).map((q, i) => `${i+1}. ${q}`).join("\n")}

Return ONLY valid JSON: {"title": "string", "description": "string"}`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    text = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(text);
    return {
      title: (parsed.title || "Market Cluster").slice(0, 70),
      description: (parsed.description || questions[0]).slice(0, 300)
    };
  } catch {
    return {
      title: "Related Prediction Markets",
      description: questions[0]
    };
  }
}
