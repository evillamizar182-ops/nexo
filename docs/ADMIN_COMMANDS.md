# 🎮 NEXO IA — Guía de Comandos de Administración

Los comandos de administración permiten controlar el bot directamente desde WhatsApp. **Solo funcionan para números configurados en `ADMIN_NUMBERS`**.

## 📋 Lista de Comandos

### Finanzas y Reportes
*   **`!stats`**
    *   **Uso:** Ver el estado financiero del día actual.
    *   **Respuesta:** Resumen de ingresos, comisiones por barbero y hora pico.
    *   *Ejemplo:* "Hoy se han generado $1,200,000. Neto negocio: $480,000."
*   **`!cierre`**
    *   **Uso:** Generar el reporte final y balance del día.
    *   **Respuesta:** Reporte detallado formateado para WhatsApp.

### Control del Bot
*   **`!pausa`**
    *   **Uso:** Detiene todas las respuestas automáticas de la IA para clientes.
    *   **Respuesta:** "⏸️ Bot pausado globalmente."
*   **`!resume`**
    *   **Uso:** Reactiva las respuestas automáticas de la IA.
    *   **Respuesta:** "▶️ Bot reactivado."

### Gestión de Clientes
*   **`!mute [número]`**
    *   **Uso:** Silencia a un cliente específico (ej: `!mute 573001234567`).
    *   **Respuesta:** "🔇 Cliente silenciado. La IA no le responderá más."
*   **`!unmute [número]`**
    *   **Uso:** Reactiva a un cliente silenciado.
    *   **Respuesta:** "✅ Cliente reactivado."

### Mantenimiento y Sistema
*   **`!status`**
    *   **Uso:** Ver el estado de salud de las conexiones externas.
    *   **Respuesta:** Estado de los Circuit Breakers (Calendar, Vision, Meta).
    *   *Ejemplo:* "🟢 *GOOGLE_CALENDAR*: CLOSED (Sano)"
*   **`!backup`**
    *   **Uso:** Realizar una copia de seguridad inmediata de la base de datos.
    *   **Respuesta:** Confirmación con nombre de archivo, tamaño y duración.

---

## 🛡️ Seguridad y Límites
1.  **Silencio Administrativo**: Si un número no autorizado intenta un comando, el bot no responderá para proteger la privacidad del sistema.
2.  **Límite de Uso**: Máximo 30 comandos por hora por administrador para evitar sobrecarga del servidor.
