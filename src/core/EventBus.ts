/**
 * A minimal typed event bus so systems (input, UI, scene, audio) can
 * communicate without holding direct references to each other.
 *
 * Usage:
 *   const bus = new EventBus<AppEvents>();
 *   bus.on("cell:selected", (payload) => { ... });
 *   bus.emit("cell:selected", { row: 0, col: 0 });
 */
type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners: {
    [K in keyof EventMap]?: Set<Listener<EventMap[K]>>;
  } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners[event]?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners = {};
  }
}
