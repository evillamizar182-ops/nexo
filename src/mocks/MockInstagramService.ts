/**
 * MOCK: InstagramService
 * Simula la recepción y envío de mensajes a través de Instagram Direct.
 * 
 * ¿Por qué?: Facilita la implementación de la omnicanalidad (IG + WhatsApp)
 * sin necesidad de configurar una App de Meta con permisos de Instagram.
 */
export class MockInstagramService {
  /**
   * Simula el envío de un mensaje directo.
   */
  async sendDirectMessage(recipientId: string, text: string): Promise<boolean> {
    console.log(`[MOCK] InstagramService.sendDirectMessage TO ${recipientId}: "${text}"`);
    return true;
  }

  /**
   * Genera un evento de webhook simulado para Instagram.
   */
  generateMockWebhookEvent(senderId: string, text: string) {
    console.log('[MOCK] Generando evento de Webhook simulado para Instagram');
    return {
      object: 'instagram',
      entry: [{
        id: 'mock_ig_page_id',
        time: Date.now(),
        messaging: [{
          sender: { id: senderId },
          recipient: { id: 'mock_ig_page_id' },
          timestamp: Date.now(),
          message: { mid: `mock_mid_${Date.now()}`, text }
        }]
      }]
    };
  }
}
