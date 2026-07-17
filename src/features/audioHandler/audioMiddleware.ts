import { audioService } from './audioService';
import { env } from '../../config/env';

/**
 * PATRÓN ADAPTER: AudioToTextAdapter
 * Intercepta mensajes de tipo 'audio' y los convierte en mensajes de tipo 'text'.
 * 
 * ¿Por qué?: Permite que el resto del sistema (AI, Herramientas, Base de Datos) 
 * siga funcionando con texto sin saber que el origen fue una nota de voz. 
 * Esto desacopla la entrada multimedia de la lógica de negocio.
 */
export async function adaptAudioMessage(message: any): Promise<any> {
  // Solo procesamos si el feature está habilitado en el .env
  if (!env.ENABLE_AUDIO_HANDLER) {
    return message;
  }

  if (message.type === 'audio' || message.type === 'voice') {
    console.log(`[ADAPTER] Convertiendo audio de ${message.from} a texto...`);
    
    const mediaId = message.audio?.id || message.voice?.id;
    if (!mediaId) return message;

    const transcription = await audioService.processVoiceNote(mediaId);

    // Transformamos el objeto mensaje para que parezca un mensaje de texto estándar
    return {
      ...message,
      type: 'text',
      text: { body: transcription },
      _originalType: 'audio' // Metadato opcional por si se necesita saber el origen
    };
  }

  return message;
}
