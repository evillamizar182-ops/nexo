import { db } from '../../repositories/index';
import { DateTime } from 'luxon';

/**
 * SERVICIO: Comisiones y Cierre
 * Calcula ganancias, comisiones por barbero y genera reportes de salud financiera.
 * 
 * ¿Por qué?: En una barbería, la transparencia en el pago a los colaboradores 
 * es vital para la retención de talento. Este servicio automatiza el cálculo 
 * tedioso del fin del día, reduciendo errores humanos.
 */
export class CommissionService {
  /**
   * Registra un servicio como finalizado y calcula la comisión en el acto.
   */
  async registerService(staffId: string, serviceId: string, price: number): Promise<void> {
    const [staff, service] = await Promise.all([
      db.staffMember.findUnique({ where: { id: staffId } }),
      db.service.findUnique({ where: { id: serviceId } }),
    ]);

    // Default 50% si el barbero no tiene comisión configurada.
    const type = staff?.commissionType || 'PERCENTAGE';
    const value = staff?.commissionValue ?? 50;

    const commission = type === 'PERCENTAGE'
      ? (price * value) / 100  // FÓRMULA: (Precio * Porcentaje) / 100
      : value;                 // FÓRMULA: Monto fijo directo

    await db.completedService.create({
      data: {
        staffId,
        serviceId,
        serviceName: service?.name || 'Servicio',
        price,
        commission,
      },
    });

    console.log(`[COMMISSIONS] Servicio registrado: $${price} (Comisión: $${commission}) para ${staffId}`);
  }

  /**
   * Genera el reporte estructurado de un día específico.
   */
  async generateDailyReport(date: string) {
    const start = DateTime.fromISO(date).startOf('day').toJSDate();
    const end = DateTime.fromISO(date).endOf('day').toJSDate();

    const services = await db.completedService.findMany({
      where: { date: { gte: start, lte: end } },
    });

    if (services.length === 0) return null;

    // 1. Resumen por Barbero
    const staffSummary: Record<string, any> = {};
    const staffList = await db.staffMember.findMany();
    
    services.forEach(s => {
      if (!staffSummary[s.staffId]) {
        const staff = staffList.find(b => b.id === s.staffId);
        staffSummary[s.staffId] = { name: staff?.name || 'Desconocido', total: 0, commission: 0, count: 0 };
      }
      staffSummary[s.staffId].total += Number(s.price);
      staffSummary[s.staffId].commission += Number(s.commission);
      staffSummary[s.staffId].count++;
    });

    // 2. Totales Globales
    const totalBusiness = services.reduce((acc, s) => acc + Number(s.price), 0);
    const totalCommissions = services.reduce((acc, s) => acc + Number(s.commission), 0);

    // 3. Servicio más popular
    const serviceCounts: Record<string, number> = {};
    services.forEach(s => serviceCounts[s.serviceName] = (serviceCounts[s.serviceName] || 0) + 1);
    const popularService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0][0];

    // 4. Hora Pico (Calculada por volumen de servicios)
    const hourCounts: Record<number, number> = {};
    services.forEach(s => {
      const h = DateTime.fromJSDate(s.date).setZone('America/Bogota').hour;
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      date,
      totalBusiness,
      totalCommissions,
      netProfit: totalBusiness - totalCommissions,
      popularService,
      peakHour: `${peakHour}:00`,
      staff: Object.values(staffSummary)
    };
  }

  /**
   * Formatea el reporte para visualización en WhatsApp (Markdown).
   */
  exportReportAsText(report: any): string {
    if (!report) return "📅 *Cierre Diario*\n\nNo se registraron servicios hoy.";

    let text = `📅 *CIERRE DIARIO (${report.date})*\n\n`;
    
    text += `💰 *FINANZAS:*\n`;
    text += `• Total Bruto: $${report.totalBusiness.toLocaleString()}\n`;
    text += `• Comisiones: $${report.totalCommissions.toLocaleString()}\n`;
    text += `• Neto Negocio: $${report.netProfit.toLocaleString()}\n\n`;

    text += `✂️ *POR BARBERO:*\n`;
    report.staff.forEach((b: any) => {
      text += `• ${b.name}: ${b.count} serv. (Gana: $${b.commission.toLocaleString()})\n`;
    });

    text += `\n📊 *INSIGHTS:*\n`;
    text += `• Servicio Estrella: ${report.popularService}\n`;
    text += `• Hora Pico: ${report.peakHour}\n`;

    return text;
  }
}

export const commissionService = new CommissionService();
