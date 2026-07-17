/**
 * MOCK: WhatsAppMediaService
 * Simula la descarga y procesamiento de archivos multimedia (imágenes y audio).
 * 
 * ¿Por qué?: Permite probar el flujo de Vision (ERP) y transcripción de audio
 * sin tener que realizar llamadas reales a los servidores de Meta para bajar archivos binarios.
 */
export class MockWhatsAppMediaService {
  /**
   * Simula la descarga de un archivo multimedia desde Meta.
   * Retorna un Buffer ficticio o una ruta local de prueba.
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    console.log(`[MOCK] WhatsAppMediaService.downloadMedia ID: ${mediaId}`);
    
    // Simulamos que el archivo se descarga y retorna un buffer de imagen mínimo
    return Buffer.from('mock_media_content');
  }

  /**
   * Simula la obtención de la URL de descarga de un mediaId.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    console.log(`[MOCK] WhatsAppMediaService.getMediaUrl ID: ${mediaId}`);
    return `https://graph.facebook.com/v21.0/mock_url_${mediaId}`;
  }

  /**
   * Simula la transcripción de un archivo de audio (usando Whisper o similar).
   */
  async transcribeAudio(mediaId: string): Promise<string> {
    console.log(`[MOCK] WhatsAppMediaService.transcribeAudio ID: ${mediaId}`);
    return 'Hola, quiero agendar una cita para hoy a las 3 de la tarde.';
  }
}
