import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

const META_API_BASE = 'https://graph.facebook.com/v21.0';

interface MetaApiError {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
  };
}

export class WhatsAppProvider {
  private readonly apiUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    this.apiUrl = `${META_API_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    this.headers = {
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Checks if a timestamp is within the WhatsApp 24-hour response window.
   */
  isWithin24h(lastMessageAt: Date | null): boolean {
    if (!lastMessageAt) return true;
    const diff = Date.now() - lastMessageAt.getTime();
    return diff < 24 * 60 * 60 * 1000;
  }

  /**
   * Send a text message to a WhatsApp number.
   * Handles 24h window, retry on transient failures, and error classification.
   */
  async sendMessage(to: string, text: string, lastMessageAt: Date | null): Promise<void> {
    if (!this.isWithin24h(lastMessageAt)) {
      console.log(`[WHATSAPP] BLOCKED: outside 24h window for ${to.substring(0, 4)}****`);
      return;
    }

    // In development mode, simulate
    if (env.NODE_ENV === 'development') {
      console.log(`[WHATSAPP_DEV] → ${to.substring(0, 4)}****: ${text.substring(0, 100)}...`);
      return;
    }

    // Split long messages (WhatsApp limit ~4096 chars, we split at 1000 for readability)
    const blocks = this.splitMessage(text, 1000);

    for (let i = 0; i < blocks.length; i++) {
      await this.apiRequest({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: blocks[i] },
      });

      // Small delay between split messages
      if (i < blocks.length - 1) {
        await this.delay(600);
      }
    }
  }

  /**
   * Core API request with retry and error classification.
   */
  private async apiRequest(body: Record<string, unknown>, retries = 2): Promise<void> {
    try {
      await axios.post(this.apiUrl, body, {
        headers: this.headers,
        timeout: 10_000,
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        const data = error.response?.data as MetaApiError | undefined;
        const code = data?.error?.code;
        const subcode = data?.error?.error_subcode;

        // 131047: 24h window expired
        if (code === 131047 || subcode === 131047) {
          console.log('[WHATSAPP] 24h window expired — cannot send freeform message');
          return;
        }

        // 131026: Invalid number
        if (code === 131026 || subcode === 131026) {
          console.log('[WHATSAPP] Invalid phone number');
          return;
        }

        // Retry transient errors
        if (retries > 0) {
          await this.delay(1500);
          return this.apiRequest(body, retries - 1);
        }
      }

      throw error;
    }
  }

  /**
   * Split long text into blocks that fit WhatsApp's display.
   */
  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const blocks: string[] = [];
    let current = '';
    const words = text.split(' ');

    for (const word of words) {
      if ((current + ' ' + word).length > maxLen) {
        blocks.push(current.trim());
        current = word;
      } else {
        current += ' ' + word;
      }
    }
    if (current.trim()) blocks.push(current.trim());

    return blocks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const whatsappProvider = new WhatsAppProvider();
