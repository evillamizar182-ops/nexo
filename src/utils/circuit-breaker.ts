/**
 * Lightweight circuit breaker for external API calls.
 * States: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (testing)
 */

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

const DEFAULT_OPTIONS: BreakerOptions = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 2,
};

export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly opts: BreakerOptions;
  public readonly name: string;

  constructor(name: string, options: Partial<BreakerOptions> = {}) {
    this.name = name;
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  getState(): { name: string; state: BreakerState; failureCount: number } {
    return { name: this.name, state: this.state, failureCount: this.failureCount };
  }

  /**
   * Execute an async function through the circuit breaker.
   * @throws Error with statusCode 503 when circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if OPEN and if reset timeout has elapsed
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.opts.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        const err = new Error(`Circuit breaker OPEN for ${this.name}`);
        (err as any).statusCode = 503;
        throw err;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.opts.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.successCount = 0;
    }
  }
}
