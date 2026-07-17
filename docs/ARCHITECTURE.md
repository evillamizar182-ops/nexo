# 🏗️ NEXO IA v15.1 — Arquitectura del Sistema

Este documento describe la estructura técnica y el flujo de datos del sistema Nexo IA v15.1, diseñado para escalabilidad enterprise y alta disponibilidad.

## 🗺️ Diagrama de Arquitectura (ASCII)

```text
       [ CANALES DE ENTRADA ]               [ NÚCLEO DE PROCESAMIENTO ]              [ SERVICIOS EXTERNOS ]
      ┌──────────────────────┐             ┌──────────────────────────┐             ┌───────────────────────┐
      │  WhatsApp Cloud API  │──────────▶  │    Webhook Handler       │◀──────────▶│  Anthropic Claude 3.5 │
      │  Instagram Direct    │             │ (HMAC / Sanitization)    │             │  (AI & Vision API)    │
      └──────────────────────┘             └────────────┬─────────────┘             └───────────────────────┘
                                                       │
                                           ┌───────────▼───────────┐
                                           │  MIDDLEWARE & ADAPTERS│
                                           │  - Audio Adapter      │
                                           │  - Admin Interceptor  │
                                           │  - Silent Mode Guard  │
                                           └───────────┬───────────┘
                                                       │
          ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
          │                                            │                                            │
┌─────────▼─────────┐                  ┌───────────────▼──────────────┐                   ┌─────────▼─────────┐
│  VISION ERP       │                  │  AI CONVERSATION CORE        │                   │  ADMIN & FINANCE  │
│ - Product Matcher │◀────────────────▶│ - Tool Loop (Prisma)         │◀────────────────▶ │ - Commission Sys  │
│ - Stock Manager   │                  │ - Context Management         │                   │ - Backup Service  │
└─────────┬─────────┘                  └───────────────┬──────────────┘                   └─────────┬─────────┘
          │                                            │                                            │
          └────────────────────────────────────────────┼────────────────────────────────────────────┘
                                                       │
                                           ┌───────────▼───────────┐
                                           │  INFRASTRUCTURE       │
                                           │  - Circuit Breakers   │
                                           │  - Rate Limiters      │
                                           │  - Redis / Postgres   │
                                           └───────────────────────┘
```

## 📦 Módulos Principales y Responsabilidades

| Módulo | Carpeta | Responsabilidad |
| :--- | :--- | :--- |
| **Admin Commands** | `features/adminCommands` | Intercepta comandos `!` para control manual por parte de administradores autorizados. |
| **Vision ERP** | `features/visionERP` | Utiliza IA Visual para identificar productos en fotos y gestionar el inventario automáticamente. |
| **Audio Handler** | `features/audioHandler` | Adapter que convierte notas de voz en texto para que la IA pueda procesarlas. |
| **Commissions** | `features/commissions` | Calcula ganancias de barberos y genera reportes de cierre financiero diario. |
| **Silent Mode** | `features/silentMode` | Permite pausar el bot o silenciar clientes específicos para intervención humana. |
| **Backup** | `features/backup` | Servicio de respaldo "en caliente" para la base de datos PostgreSQL. |
| **Contacts Sync** | `features/contactsSync` | Sincroniza automáticamente los números de clientes con Google Contacts. |
| **Remarketing** | `features/remarketing` | Tarea programada (Cron) para seguimiento de clientes a las 10:00 AM. |
| **Resilience** | `infrastructure/` | Circuit Breakers granulares y **Prometheus Metrics** para monitoreo industrial. |

## ⚙️ Guía de Variables de Entorno (Nuevas)

Añade estas variables a tu archivo `.env` para habilitar las nuevas funcionalidades:

| Variable | Descripción | Valor Default |
| :--- | :--- | :--- |
| `ADMIN_NUMBERS` | Lista de números de WhatsApp (con código de país) autorizados para usar comandos `!`. | `N/A` |
| `ENABLE_AUDIO_HANDLER` | Activa (`true`) o desactiva (`false`) el soporte para notas de voz. | `false` |
| `USE_MOCKS` | Si es `true`, usa servicios simulados en lugar de APIs reales (para desarrollo). | `false` |
| `CB_FAILURE_THRESHOLD`| Número de fallos seguidos antes de que el Circuit Breaker bloquee un servicio. | `3` |
| `CB_RECOVERY_TIMEOUT` | Tiempo (ms) que el sistema espera antes de intentar reconectar un servicio caído. | `30000` |
