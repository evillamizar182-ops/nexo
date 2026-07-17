import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions for the Anthropic messages API.
 * These map 1:1 to business operations the AI can perform.
 */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description: 'Consulta los horarios disponibles para agendar una cita. Usar cuando el cliente quiera saber disponibilidad.',
    input_schema: {
      type: 'object' as const,
      properties: {
        barbero: {
          type: 'string',
          description: 'Nombre exacto del barbero o "cualquiera" si no tiene preferencia.',
        },
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD. Solo fechas futuras dentro de los próximos 30 días.',
        },
        servicio: {
          type: 'string',
          description: 'Nombre del servicio que desea (ej: "Corte", "Barba", "Corte y Barba").',
        },
      },
      required: ['barbero', 'fecha', 'servicio'],
    },
  },
  {
    name: 'reserve_appointment',
    description: 'Reserva una cita SOLO cuando el cliente haya confirmado explícitamente barbero, fecha, hora y servicio. NUNCA asumir datos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        barbero: {
          type: 'string',
          description: 'Nombre exacto del barbero.',
        },
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD.',
        },
        hora: {
          type: 'string',
          description: 'Hora en formato HH:mm (24h).',
        },
        servicio: {
          type: 'string',
          description: 'Nombre del servicio confirmado.',
        },
        nombre_cliente: {
          type: 'string',
          description: 'Nombre del cliente para la cita.',
        },
      },
      required: ['barbero', 'fecha', 'hora', 'servicio'],
    },
  },
  {
    name: 'check_inventory',
    description: 'Consulta el stock disponible de un producto en el inventario del negocio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        producto: {
          type: 'string',
          description: 'Nombre del producto a consultar (ej: "Pomada", "Aceite de barba").',
        },
      },
      required: ['producto'],
    },
  },
  {
    name: 'get_services',
    description: 'Lista todos los servicios disponibles (cortes, barba, combos) con sus precios y duración. Usar al inicio para que el cliente elija.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

