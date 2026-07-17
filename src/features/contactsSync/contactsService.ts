import { google } from 'googleapis';
import { env } from '../../config/env';

/**
 * SERVICIO: ContactsSync
 * Sincroniza los clientes de la barbería con Google Contacts.
 * 
 * ¿Por qué?: Permite que el dueño del negocio vea el nombre del cliente 
 * en su celular cuando entra una llamada o mensaje, humanizando la relación 
 * y facilitando la gestión de la agenda personal.
 */
export class ContactsService {
  private getOAuth2Client() {
    if (!env.GOOGLE_OAUTH_REFRESH_TOKEN) return null;

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_OAUTH_CLIENT_ID,
      env.GOOGLE_OAUTH_CLIENT_SECRET,
      'http://localhost:8080'
    );
    
    oauth2Client.setCredentials({ 
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN 
    });
    
    return oauth2Client;
  }

  /**
   * Guarda o actualiza un contacto en Google People API.
   */
  async saveContact(phone: string, name?: string): Promise<boolean> {
    const auth = this.getOAuth2Client();
    if (!auth) {
      console.warn('[CONTACTS_SYNC] Google OAuth no configurado.');
      return false;
    }

    try {
      const people = google.people({ version: 'v1', auth });
      const phoneFormatted = phone.startsWith('+') ? phone : `+${phone}`;
      const displayName = name || `Cliente ${phone.slice(-4)}`;

      // 1. Buscar si ya existe para evitar duplicados
      try {
        const search = await people.people.searchContacts({
          query: phoneFormatted,
          readMask: 'names,phoneNumbers',
          pageSize: 1
        });

        if (search.data.results && search.data.results.length > 0) {
          console.log(`[CONTACTS_SYNC] Contacto ya existe para ${phoneFormatted}.`);
          return true;
        }
      } catch (err) {
        // Ignorar error de búsqueda y proceder a crear
      }

      // 2. Crear nuevo contacto
      await people.people.createContact({
        requestBody: {
          names: [{ displayName }],
          phoneNumbers: [{ value: phoneFormatted, type: 'mobile' }],
          organizations: [{ name: 'Nexo IA - Cliente Barbería' }],
          biographies: [{ value: 'Sincronizado automáticamente por Nexo IA', contentType: 'TEXT_PLAIN' }]
        }
      });

      console.log(`[CONTACTS_SYNC] ✅ Contacto guardado: ${displayName}`);
      return true;
    } catch (error: any) {
      console.error('[CONTACTS_SYNC] ❌ Error al sincronizar:', error.message);
      return false;
    }
  }
}

export const contactsService = new ContactsService();
