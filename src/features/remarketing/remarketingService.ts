import cron from 'node-cron';
import { db } from '../../repositories/index';
import { whatsappProvider } from '../../services/whatsapp.provider';
import { DateTime } from 'luxon';

/**
 * SERVICIO: Remarketing Automático
 * Ejecuta campañas de seguimiento para clientes que no han agendado en un tiempo.
 * 
 * ¿Por qué?: El 30% de las ventas perdidas se recuperan con un simple recordatorio. 
 * Automatizar esto a las 10:00 AM asegura estar en la mente del cliente 
 * al iniciar su jornada.
 */
export class RemarketingService {
  /**
   * Inicializa la tarea programada.
   */
  init() {
    // Programado para las 10:00 AM todos los días (America/Bogota)
    cron.schedule('0 10 * * *', () => {
      this.executeDailyCampaign();
    }, {
      timezone: "America/Bogota"
    });
    
    console.log('[REMARKETING] ⏰ Servicio inicializado (10:00 AM Daily)');
  }

  async executeDailyCampaign() {
    console.log('[REMARKETING] 🚀 Iniciando campaña diaria de seguimiento...');
    
    const threeWeeksAgo = DateTime.now().minus({ weeks: 3 }).toJSDate();

    // Buscamos clientes que su última cita fue hace 3 semanas
    // Esto es un "recordatorio de mantenimiento" estándar en barberías
    const targets = await db.client.findMany({
      where: {
        appointments: {
          some: {
            startTime: {
              lte: threeWeeksAgo
            }
          }
        }
      },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 1
        }
      }
    });

    for (const client of targets) {
      const lastAppt = client.appointments[0];
      if (!lastAppt) continue;

      const message = `¡Hola ${client.name || 'amigo'}! 👋 Hace un tiempo que no nos vemos para tu ${lastAppt.serviceName}. ¿Te gustaría agendar para esta semana?`;
      
      try {
        // Usamos el provider de WhatsApp con el check de 24h
        // Nota: En producción real, esto requeriría un Template de Meta si pasaron > 24h.
        await whatsappProvider.sendMessage(client.phoneHash, message, lastAppt.startTime);
        console.log(`[REMARKETING] Mensaje enviado a ${client.id}`);
      } catch (err) {
        console.error(`[REMARKETING] Error enviando a ${client.id}`);
      }

      // Evitar ráfagas que bloqueen el API
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export const remarketingService = new RemarketingService();
