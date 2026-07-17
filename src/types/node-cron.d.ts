// node-cron no trae tipos propios ni existe @types/node-cron oficial estable.
// Declaración mínima para el uso que hace el proyecto (schedule).
declare module 'node-cron' {
  export interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }
  export function schedule(
    expression: string,
    task: () => void,
    options?: { scheduled?: boolean; timezone?: string }
  ): ScheduledTask;
  export function validate(expression: string): boolean;
  const _default: { schedule: typeof schedule; validate: typeof validate };
  export default _default;
}
