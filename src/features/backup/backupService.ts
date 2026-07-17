import { spawn } from 'child_process';
import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';

/**
 * Ejecuta pg_dump SIN shell: DATABASE_URL se pasa como un único argv, no se
 * interpola en una línea de comandos, así que no hay superficie de command
 * injection aunque la cadena contenga metacaracteres. stdout se vuelca al
 * archivo por stream (soporta volcados grandes sin bufferizar en memoria).
 */
function runPgDump(databaseUrl: string, outputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(outputPath);
    const child = spawn('pg_dump', [databaseUrl], { shell: false });
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    out.on('error', reject);
    child.on('close', (code) => {
      out.end();
      if (code === 0) resolve();
      else reject(new Error(`pg_dump salió con código ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

/**
 * SERVICIO: HotBackup (Copia de Seguridad en Caliente)
 * Realiza volcados de la base de datos PostgreSQL en tiempo de ejecución.
 * 
 * ¿Por qué el backup en caliente es COMPLEMENTARIO?:
 * 1. Control Granular: Permite al admin asegurar el estado de la DB antes de un cambio crítico (ej: migraciones).
 * 2. Recuperación Rápida: Los backups locales son más rápidos de restaurar que descargar un snapshot de la nube.
 * 3. NO SUSTITUYE: El backup nativo de PostgreSQL (ej: en Railway o AWS) ofrece PITR (Point-in-Time Recovery),
 *    mientras que este servicio solo toma "fotos" estáticas del momento.
 */
export class BackupService {
  private readonly backupDir = path.resolve(process.cwd(), 'backups');
  private readonly MAX_BACKUPS = 7;

  constructor() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Ejecuta pg_dump para generar un archivo .sql
   */
  async executeHotBackup(): Promise<{ success: boolean; filename?: string; size?: string; duration?: string; error?: string }> {
    const start = Date.now();
    const ts = DateTime.now().toFormat('yyyy-MM-dd_HH-mm');
    const filename = `backup_${ts}.sql`;
    const outputPath = path.join(this.backupDir, filename);

    try {
      console.log(`[BACKUP] Iniciando volcado de base de datos en: ${filename}`);

      // pg_dump lee la conexión desde el argv (DATABASE_URL). Sin shell => sin injection.
      await runPgDump(env.DATABASE_URL, outputPath);

      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - start) / 1000).toFixed(2);

      await this.rotateBackups();

      return {
        success: true,
        filename,
        size: `${sizeMB} MB`,
        duration: `${duration}s`
      };
    } catch (error: any) {
      console.error(`[BACKUP] ❌ Fallo crítico en backup:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mantiene solo los últimos 7 archivos para no saturar el disco.
   */
  private async rotateBackups(): Promise<void> {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .map(f => ({ name: f, time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > this.MAX_BACKUPS) {
      const toDelete = files.slice(this.MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(this.backupDir, file.name));
        console.log(`[BACKUP] Rotación: Eliminado backup antiguo ${file.name}`);
      }
    }
  }
}

export const backupService = new BackupService();
