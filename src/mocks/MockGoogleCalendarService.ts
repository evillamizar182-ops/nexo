/**
 * MOCK: GoogleCalendarService
 * Simula la creación y consulta de eventos en Google Calendar.
 * 
 * ¿Por qué?: Evita llenar el calendario real del negocio con datos de prueba
 * y permite desarrollar la lógica de conflictos de horario sin conexión a internet.
 */
export class MockGoogleCalendarService {
  /**
   * Simula la creación de un evento.
   * Retorna un ID ficticio y confirma la operación.
   */
  async createEvent(eventData: any): Promise<any> {
    console.log('[MOCK] GoogleCalendarService.createEvent:', eventData.summary);
    
    // Simula delay de red
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      id: `mock_evt_${Date.now()}`,
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/mock-event'
    };
  }

  /**
   * Simula la obtención de eventos para una fecha.
   * Retorna una lista vacía o con eventos ficticios según la fecha.
   */
  async listEvents(timeMin: string, timeMax: string): Promise<any[]> {
    console.log(`[MOCK] GoogleCalendarService.listEvents de ${timeMin} a ${timeMax}`);
    
    // Simula un evento existente a las 10:00 AM si es para "hoy"
    const todayStr = new Date().toISOString().split('T')[0];
    if (timeMin.includes(todayStr)) {
      return [{
        id: 'mock_existing_1',
        summary: 'Corte (Mock)',
        start: { dateTime: `${todayStr}T10:00:00-05:00` },
        end: { dateTime: `${todayStr}T11:00:00-05:00` }
      }];
    }

    return [];
  }
}
