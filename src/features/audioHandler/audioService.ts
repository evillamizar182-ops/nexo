import axios from 'axios';
import { env } from '../../config/env';

/**
 * SERVICIO: AudioHandler
 * Procesa notas de voz de WhatsApp, las descarga y las transcribe a texto.
 *
 * ¿Por qué?: Permite que el bot sea accesible para clientes que prefieren hablar
 * en lugar de escribir, integrando el audio de forma transparente en el pipeline de texto.
 */

// ─── Blindaje SSRF / DoS de la descarga de media ─────────────────────────────
// Este flujo lo puede disparar CUALQUIER cliente (una nota de voz), y adjunta el
// WHATSAPP_ACCESS_TOKEN a la petición de descarga. Por eso:
//   1. El mediaId se valida (solo dígitos) — nunca se interpola texto arbitrario
//      en la URL de la Graph API.
//   2. La URL de descarga que devuelve Meta se valida contra una allowlist de
//      hosts de Meta ANTES de mandarle el token → un host inesperado nunca
//      recibe nuestras credenciales (evita exfiltración vía SSRF).
//   3. Tope de tamaño + timeout → una media gigante no puede agotar memoria.
const MEDIA_HOST_ALLOWLIST = new Set([
  'graph.facebook.com',
  'lookaside.fbsbx.com',
]);
const MEDIA_HOST_SUFFIXES = ['.fbcdn.net', '.cdninstagram.com', '.facebook.com'];
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB
const HTTP_TIMEOUT_MS = 10_000;

function isAllowedMetaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return MEDIA_HOST_ALLOWLIST.has(host) || MEDIA_HOST_SUFFIXES.some(s => host.endsWith(s));
}

/** Valida que una URL sea https y apunte a un host de Meta. Lanza si no. */
function assertMetaMediaUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || !rawUrl) throw new Error('MEDIA_URL_MISSING');
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('MEDIA_URL_INVALID');
  }
  if (u.protocol !== 'https:') throw new Error('MEDIA_URL_NOT_HTTPS');
  if (!isAllowedMetaHost(u.hostname)) throw new Error(`MEDIA_HOST_NOT_ALLOWED: ${u.hostname}`);
  return u.toString();
}

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
    // El mediaId viene del webhook (influenciable por el remitente). Los IDs de
    // media de Meta son numéricos: se rechaza cualquier otra cosa para que no se
    // pueda inyectar query/path que altere la petición a la Graph API.
    if (!/^\d{1,40}$/.test(mediaId)) {
      throw new Error('MEDIA_ID_INVALID');
    }

    const response = await axios.get(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
      headers: this.headers,
      timeout: HTTP_TIMEOUT_MS,
      maxContentLength: 64 * 1024, // metadata pequeña
    });
    // Valida el host de la URL de descarga ANTES de usarla (no adjuntar el token
    // a un host que no sea de Meta).
    return assertMetaMediaUrl(response.data?.url);
  }

  private async downloadAndTranscribe(url: string): Promise<string> {
    // Doble verificación defensiva del host justo antes de mandar el token.
    const safeUrl = assertMetaMediaUrl(url);

    // 1. Descarga del Buffer (con tope de tamaño y timeout → sin DoS de memoria)
    const response = await axios.get(safeUrl, {
      headers: this.headers,
      responseType: 'arraybuffer',
      timeout: HTTP_TIMEOUT_MS,
      maxContentLength: MAX_MEDIA_BYTES,
      maxBodyLength: MAX_MEDIA_BYTES,
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
