import { env } from '../config/env';

/**
 * PATRÓN CIRCUIT BREAKER (Cortocircuito)
 * 
 * ¿Por qué?: En un sistema distribuido o con APIs externas (Meta, Anthropic, Google), 
 * si un servicio remoto empieza a fallar, no queremos que nuestra aplicación 
 * siga intentándolo infinitamente, bloqueando recursos y empeorando la situación.
 * 
 * El Circuit Breaker actúa como un interruptor:
 * - CLOSED: El servicio funciona normalmente. Las peticiones pasan.
 * - OPEN: El servicio ha fallado repetidamente. Las peticiones se bloquean 
 *   instantáneamente (Fail-fast) para proteger el sistema.
 * - HALF-OPEN: Tras un tiempo de espera, se permite una petición de prueba 
 *   para ver si el servicio remoto se ha recuperado.
 */

export type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CBStatus {
  service: string;
  state: CBState;
  failureCount: number;
  lastFailure: string | null;
  nextAttempt: string | null;
}

class EnhancedCircuitBreaker {
  private state: CBState = 'CLOSED';
  private failures: number[] = []; // Timestamps de fallos
  private lastStateChange: number = Date.now();
  
  private readonly threshold: number;
  private readonly windowMs: number = 60_000; // Ventana fija de 60s
  private readonly recoveryTimeoutMs: number;

  constructor(
    public readonly name: string,
    threshold?: number,
    recoveryTimeout?: number
  ) {
    this.threshold = threshold || Number(env.CB_FAILURE_THRESHOLD || 3);
    this.recoveryTimeoutMs = recoveryTimeout || Number(env.CB_RECOVERY_TIMEOUT || 30_000);
  }

  /**
   * Ejecuta una función protegida por el breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();

    if (this.state === 'OPEN') {
      console.warn(`[CIRCUIT_BREAKER] 🛑 BLOQUEADO: ${this.name} está en estado OPEN.`);
      throw new Error(`Servicio ${this.name} temporalmente no disponible (Circuit Breaker OPEN).`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private updateState(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastStateChange;
      if (elapsed >= this.recoveryTimeoutMs) {
        this.changeState('HALF_OPEN');
      }
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.changeState('CLOSED');
      this.failures = [];
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures.push(now);

    // Limpiar fallos fuera de la ventana de tiempo
    this.failures = this.failures.filter(f => now - f <= this.windowMs);

    if (this.state === 'HALF_OPEN' || this.failures.length >= this.threshold) {
      this.changeState('OPEN');
    }
  }

  private changeState(newState: CBState): void {
    if (this.state !== newState) {
      const timestamp = new Date().toISOString();
      console.log(`[CIRCUIT_BREAKER] [${timestamp}] 🔄 CAMBIO DE ESTADO: ${this.name} (${this.state} -> ${newState})`);
      this.state = newState;
      this.lastStateChange = Date.now();
    }
  }

  getStatus(): CBStatus {
    return {
      service: this.name,
      state: this.state,
      failureCount: this.failures.length,
      lastFailure: this.failures.length > 0 ? new Date(this.failures[this.failures.length - 1]).toISOString() : null,
      nextAttempt: this.state === 'OPEN' ? new Date(this.lastStateChange + this.recoveryTimeoutMs).toISOString() : null
    };
  }
}

/**
 * MANAGER DE CIRCUIT BREAKERS GRANULARES
 * Gestiona instancias independientes para no afectar canales sanos si uno falla.
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers: Map<string, EnhancedCircuitBreaker> = new Map();

  private constructor() {
    // Inicialización de breakers granulares requeridos
    this.breakers.set('GOOGLE_CALENDAR', new EnhancedCircuitBreaker('GOOGLE_CALENDAR'));
    this.breakers.set('ANTHROPIC_VISION', new EnhancedCircuitBreaker('ANTHROPIC_VISION'));
    this.breakers.set('INSTAGRAM', new EnhancedCircuitBreaker('INSTAGRAM'));
    this.breakers.set('GOOGLE_CONTACTS', new EnhancedCircuitBreaker('GOOGLE_CONTACTS'));
  }

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  getBreaker(service: 'GOOGLE_CALENDAR' | 'ANTHROPIC_VISION' | 'INSTAGRAM' | 'GOOGLE_CONTACTS'): EnhancedCircuitBreaker {
    return this.breakers.get(service)!;
  }

  getAllStatuses(): CBStatus[] {
    return Array.from(this.breakers.values()).map(b => b.getStatus());
  }
}

export const cbManager = CircuitBreakerManager.getInstance();
