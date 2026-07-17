import { z } from 'zod';
import { DateTime } from 'luxon';
import {
  BarberoSchema,
  FechaSchema,
  HoraSchema,
  ServicioSchema,
  NombreClienteSchema,
  ProductoSchema,
} from '../../utils/sanitizer';

const BUSINESS_START = 8;
const BUSINESS_END = 20;
const MAX_DAYS_AHEAD = 30;

const today = () => DateTime.now().setZone('America/Bogota').toISODate()!;
const maxDate = () => DateTime.now().setZone('America/Bogota').plus({ days: MAX_DAYS_AHEAD }).toISODate()!;

// ─── Composed Schemas ────────────────────────────────────────────────────────

const CheckAvailabilitySchema = z.object({
  barbero: BarberoSchema,
  fecha: FechaSchema
    .refine(f => f >= today(), 'La fecha debe ser hoy o en el futuro')
    .refine(f => f <= maxDate(), `La fecha debe estar dentro de los próximos ${MAX_DAYS_AHEAD} días`),
  servicio: ServicioSchema,
});

const ReserveAppointmentSchema = z.object({
  barbero: BarberoSchema,
  fecha: FechaSchema
    .refine(f => f >= today(), 'La fecha debe ser hoy o en el futuro')
    .refine(f => f <= maxDate(), `La fecha debe estar dentro de los próximos ${MAX_DAYS_AHEAD} días`),
  hora: HoraSchema
    .refine(h => {
      const [hh] = h.split(':').map(Number);
      return hh >= BUSINESS_START && hh < BUSINESS_END;
    }, `La hora debe estar dentro del horario (${BUSINESS_START}:00 - ${BUSINESS_END}:00)`),
  servicio: ServicioSchema,
  nombre_cliente: NombreClienteSchema,
});

const CheckInventorySchema = z.object({
  producto: ProductoSchema,
});

const GetServicesSchema = z.object({});

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  check_availability: CheckAvailabilitySchema,
  reserve_appointment: ReserveAppointmentSchema,
  check_inventory: CheckInventorySchema,
  get_services: GetServicesSchema,
};


export type ValidatedInput<T = unknown> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

/**
 * Validates tool input against the appropriate Zod schema.
 * Returns structured error messages the AI can relay to the user.
 */
export function validateToolInput(toolName: string, input: unknown): ValidatedInput {
  const schema = SCHEMAS[toolName];
  if (!schema) {
    return { success: false, error: `Herramienta desconocida: ${toolName}` };
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return { success: false, error: messages };
  }

  return { success: true, data: result.data };
}
