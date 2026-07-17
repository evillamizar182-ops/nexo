import type Anthropic from '@anthropic-ai/sdk';

/**
 * MOCK: AnthropicService
 * Simula la API de Anthropic, incluyendo la Vision API para reconocimiento de productos.
 * 
 * ¿Por qué?: Permite probar flujos de venta por foto sin gastar créditos de Claude
 * ni requerir imágenes reales durante el desarrollo del ERP.
 */
export class MockAnthropicService {
  /**
   * Simula la creación de un mensaje de Anthropic.
   * Si detecta una imagen en el input (Vision), devuelve una respuesta predefinida.
   */
  async createMessage(params: Anthropic.MessageCreateParams): Promise<any> {
    console.log('[MOCK] AnthropicService.createMessage called');

    const lastMessage = params.messages[params.messages.length - 1];
    const hasImage = Array.isArray(lastMessage.content) && 
                     lastMessage.content.some(c => c.type === 'image');

    if (hasImage) {
      // Simulación de Vision API según el contenido del mensaje (caption o contexto)
      const textContent = Array.isArray(lastMessage.content) 
        ? lastMessage.content.find(c => c.type === 'text') as any 
        : { text: '' };
      
      const text = textContent?.text?.toLowerCase() || '';

      if (text.includes('error')) {
        console.log('[MOCK] Simulando error de API de Vision');
        throw new Error('API Error: Connection failed');
      }

      if (text.includes('desconocido')) {
        console.log('[MOCK] Simulando producto NO reconocido');
        return {
          id: 'mock_msg_vision_fail',
          role: 'assistant',
          content: [{ type: 'text', text: 'Lo siento, no reconozco este producto. ¿Es un artículo nuevo?' }],
          stop_reason: 'end_turn'
        };
      }

      console.log('[MOCK] Simulando producto RECONOCIDO (Pomada Mate)');
      return {
        id: 'mock_msg_vision_success',
        role: 'assistant',
        content: [{ 
          type: 'text', 
          text: 'He identificado una "Pomada Mate Nexo". El precio es $45.000 COP. ¿Deseas que registre la venta?' 
        }],
        stop_reason: 'end_turn'
      };
    }

    // Respuesta de texto estándar
    return {
      id: 'mock_msg_text',
      role: 'assistant',
      content: [{ type: 'text', text: 'Esta es una respuesta simulada de Nexo IA.' }],
      stop_reason: 'end_turn'
    };
  }
}
