export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    const arr = this.handlers.get(name);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  emit(name, payload) {
    const arr = this.handlers.get(name);
    if (!arr) return;
    for (const fn of arr) fn(payload);
  }
}
