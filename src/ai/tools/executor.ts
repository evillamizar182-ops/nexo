import { DateTime } from 'luxon';
import { db } from '../../repositories/index';
import { validateToolInput } from './validator';
import { insensitive } from '../../utils/db';

// Zona horaria del negocio. Las horas de cita las escribe/lee la IA en hora local
// del negocio (igual que el system prompt en ai/prompts.ts). Anclamos aquí para
// que el Date almacenado NO dependa de la TZ del sistema operativo del servidor
// (en producción suele ser UTC → las citas quedarían corridas varias horas).
const BUSINESS_TZ = 'America/Bogota';
const localDate = (iso: string): Date => DateTime.fromISO(iso, { zone: BUSINESS_TZ }).toJSDate();

interface ToolContext {
  clientPhone: string;
  clientId: string;
  clientName: string;
}

/**
 * Executes a tool by name after Zod validation.
 * Returns a JSON-serializable result for the Anthropic tool_result message.
 */
export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext
): Promise<Record<string, unknown>> {
  // 1. VALIDATE — always first
  const validation = validateToolInput(name, input);
  if (!validation.success) {
    return {
      error: 'INVALID_INPUT',
      message: `Para continuar necesito corregir: ${validation.error}`,
    };
  }

  const validInput = validation.data as Record<string, string>;

  // 2. EXECUTE
  switch (name) {
    case 'check_availability': {
      const staff = validInput.barbero === 'cualquiera'
        ? await db.staffMember.findMany({ where: { isActive: true } })
        : await db.staffMember.findMany({ where: { name: validInput.barbero, isActive: true } });

      if (!staff.length) {
        return { available: false, message: 'No encontré ese barbero en el equipo.' };
      }

      const startOfDay = localDate(`${validInput.fecha}T00:00:00`);
      const endOfDay = localDate(`${validInput.fecha}T23:59:59`);

      const existingAppointments = await db.appointment.findMany({
        where: {
          staffId: { in: staff.map(s => s.id) },
          startTime: { gte: startOfDay, lte: endOfDay },
          status: { in: ['confirmed', 'confirmada'] },
        },
        select: { startTime: true, endTime: true, staffId: true },
      });

      // Also check active holds
      const activeHolds = await db.slotHold.findMany({
        where: {
          staffId: { in: staff.map(s => s.id) },
          expiresAt: { gt: new Date() },
        },
      });

      // Build available slots (8:00-20:00, 30min intervals)
      const slots: Array<{ hora: string; barbero: string }> = [];
      for (const member of staff) {
        for (let hour = 8; hour < 20; hour++) {
          for (const minute of [0, 30]) {
            const slotStart = localDate(`${validInput.fecha}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
            const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

            const isBooked = existingAppointments.some(
              a => a.staffId === member.id && slotStart < a.endTime && slotEnd > a.startTime
            );
            const isHeld = activeHolds.some(
              h => h.staffId === member.id
            );

            if (!isBooked && !isHeld) {
              slots.push({
                hora: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                barbero: member.name,
              });
            }
          }
        }
      }

      if (!slots.length) {
        return { available: false, message: 'No hay horarios disponibles para esa fecha y barbero.' };
      }

      return {
        available: true,
        slots: slots.slice(0, 10), // Limit to 10 to keep context small
        fecha: validInput.fecha,
        barbero: validInput.barbero,
      };
    }

    case 'reserve_appointment': {
      const staffMember = await db.staffMember.findFirst({
        where: { name: validInput.barbero, isActive: true },
      });

      if (!staffMember) {
        return { error: 'BARBERO_NOT_FOUND', message: `No encontré al barbero "${validInput.barbero}".` };
      }

      const service = await db.service.findFirst({
        where: { name: { contains: validInput.servicio, ...insensitive }, isActive: true },
      });

      if (!service) {
        return { error: 'SERVICE_NOT_FOUND', message: `No encontré el servicio "${validInput.servicio}".` };
      }

      const startTime = localDate(`${validInput.fecha}T${validInput.hora}:00`);
      const endTime = new Date(startTime.getTime() + service.durationMin * 60 * 1000);

      // Check for conflicts
      const conflict = await db.appointment.findFirst({
        where: {
          staffId: staffMember.id,
          status: { in: ['confirmed', 'confirmada'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (conflict) {
        return { error: 'SLOT_TAKEN', message: 'Ese horario ya fue reservado. ¿Quieres intentar con otra hora?' };
      }

      // Create appointment
      const appointment = await db.appointment.create({
        data: {
          clientId: context.clientId,
          staffId: staffMember.id,
          startTime,
          endTime,
          serviceName: service.name,
          price: service.price,
          status: 'confirmada',
        },
      });

      return {
        success: true,
        message: `¡Cita reservada! ${service.name} con ${staffMember.name} el ${validInput.fecha} a las ${validInput.hora}.`,
        appointmentId: appointment.id,
      };
    }

    case 'check_inventory': {
      const product = await db.product.findFirst({
        where: { name: { contains: validInput.producto, ...insensitive }, isActive: true },
      });

      if (!product) {
        return { found: false, message: `No encontré el producto "${validInput.producto}" en el inventario.` };
      }

      return {
        found: true,
        nombre: product.name,
        precio: product.price,
        stock: product.stock,
        disponible: product.stock > 0,
      };
    }

    case 'get_services': {
      const services = await db.service.findMany({
        where: { isActive: true },
        select: { name: true, price: true, durationMin: true },
      });

      return { services };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

