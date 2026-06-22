import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const EMBED_MODEL = "gemini-embedding-001"; // 3072 dimensions with current Gemini surface for the test key
const EMBEDDING_DIM = 3072;
const MIN_SEMANTIC_SIMILARITY = 0.58; // tune as needed for semantic filter

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

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // Minimal: sequential to stay within free tier / simple. Can optimize with batchEmbedContents later.
  const embeddings: number[][] = [];
  for (const t of texts) {
    embeddings.push(await embedText(t));
  }
  return embeddings;
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
