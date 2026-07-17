import { Product } from '@prisma/client';

/**
 * UTILITY: ProductMatcher
 * Compara la descripción generada por la IA con el catálogo real de productos.
 * 
 * ¿Por qué?: La IA puede describir un producto de forma natural (ej: "Pomada azul mate"), 
 * pero en la DB puede estar como "Nexo Matte Wax 100g". Este matcher cierra esa brecha.
 */
export interface MatchResult {
  product: Product | null;
  confidence: number;
  alternatives: Product[];
}

export class ProductMatcher {
  /**
   * Encuentra el producto más probable basándose en keywords.
   */
  matchProductByDescription(aiDescription: string, catalog: Product[]): MatchResult {
    const aiTokens = this.tokenize(aiDescription);
    const scoredProducts = catalog.map(p => {
      const productTokens = this.tokenize(`${p.name} ${p.description || ''}`);
      const score = this.calculateOverlap(aiTokens, productTokens);
      return { product: p, score };
    }).sort((a, b) => b.score - a.score);

    const top = scoredProducts[0];
    const confidence = top ? top.score : 0;

    return {
      product: confidence >= 0.5 ? top.product : null,
      confidence,
      alternatives: scoredProducts.slice(0, 3).map(s => s.product)
    };
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(t => t.length > 2); // Ignorar palabras cortas (de, la, el)
  }

  private calculateOverlap(tokensA: string[], tokensB: string[]): number {
    const intersection = tokensA.filter(t => tokensB.includes(t));
    if (tokensA.length === 0) return 0;
    // Score basado en qué porcentaje de las palabras de la IA coinciden con el producto
    return intersection.length / tokensA.length;
  }
}

export const productMatcher = new ProductMatcher();
