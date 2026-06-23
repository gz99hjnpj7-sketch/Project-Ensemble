export type SemanticMatchInput = {
  question: string;
  eventTitle?: string | null;
  candidates: Array<{
    slug: string;
    title: string;
    description?: string | null;
  }>;
};

export type SemanticProvider = {
  match(input: SemanticMatchInput): Promise<string | null>;
};

export class NullSemanticProvider implements SemanticProvider {
  async match(): Promise<string | null> {
    return null;
  }
}

export const semanticProvider = new NullSemanticProvider();
