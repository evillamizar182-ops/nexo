import axios from 'axios';
import { env } from '../../config/env';

/**
 * SERVICIO: AudioHandler
 * Procesa notas de voz de WhatsApp, las descarga y las transcribe a texto.
 * 
 * ¿Por qué?: Permite que el bot sea accesible para clientes que prefieren hablar 
 * en lugar de escribir, integrando el audio de forma transparente en el pipeline de texto.
 */
export class AudioService {
  private readonly headers = {
    'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
  };

  /**
   * Procesa una nota de voz completa.
   * Si la transcripción tarda más de 10s, lanza un timeout.
   */
  async processVoiceNote(mediaId: string): Promise<string> {
    console.log(`[AUDIO_HANDLER] Procesando nota de voz ID: ${mediaId}`);

    try {
      // 1. Obtener URL de descarga
      const mediaUrl = await this.getMediaUrl(mediaId);

      // 2. Descargar y Transcribir con Timeout de 10s
      const transcription = await Promise.race([
        this.downloadAndTranscribe(mediaUrl),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 10000)
        )
      ]);

      return transcription;
    } catch (error: any) {
      if (error.message === 'TIMEOUT_EXCEEDED') {
        console.warn(`[AUDIO_HANDLER] ⏱️ Timeout en transcripción de ${mediaId}`);
        return 'No pude entender el audio a tiempo, ¿puedes escribirmelo?';
      }
      console.error(`[AUDIO_HANDLER] ❌ Error procesando audio:`, error.message);
      return 'No pude procesar tu nota de voz. Por favor, intenta escribirme.';
    }
  }

  private async getMediaUrl(mediaId: string): Promise<string> {
    const response = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: this.headers
    });
    return response.data.url;
  }

  private async downloadAndTranscribe(url: string): Promise<string> {
    // 1. Descarga del Buffer
    const response = await axios.get(url, {
      headers: this.headers,
      responseType: 'arraybuffer'
    });
    const buffer = Buffer.from(response.data);

    // 2. Transcripción (Simulación o integración con Whisper)
    // En un entorno real, aquí se enviaría el buffer a OpenAI Whisper o Google Speech-to-Text.
    return this.mockTranscription(buffer);
  }

  private async mockTranscription(_buffer: Buffer): Promise<string> {
    // Simulamos un delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));
    return "Hola, quisiera agendar una cita para un corte de cabello mañana por la tarde.";
  }
}

export const audioService = new AudioService();
