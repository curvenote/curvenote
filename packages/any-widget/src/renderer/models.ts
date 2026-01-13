/**
 * Forked from https://github.com/manzt/anymyst/commit/d0b2c105397f5b1a0344b4b467c3790c498a84c6
 *
 * A shim for the anywidget model interface
 * @see {@link https://github.com/manzt/anywidget/tree/main/packages/types}
 */
export class MystAnyModel {
  #state: Record<string, unknown>;
  #target = new EventTarget();
  constructor(state: Record<string, unknown>) {
    this.#state = state;
  }
  get(name: string) {
    return this.#state[name];
  }
  set(key: string, value: unknown) {
    this.#state[key] = value;
    this.#target.dispatchEvent(new CustomEvent(`change:${key}`, { detail: value }));
    this.#target.dispatchEvent(new CustomEvent('change', { detail: value }));
  }
  on(name: string, cb: () => void | Promise<void>) {
    this.#target.addEventListener(name, cb);
  }
  off(_name: string, _cb: () => void | Promise<void>) {
    // TODO: should keep ref to listeners and then remove here
    throw new Error('MystAnyModel.off not implemented yet.');
  }
  save_changes() {
    // nothing to sync but necessary
    throw new Error('MystAnyModel.save_changes not implemented yet.');
  }
  send(_msg: unknown, _callbacks?: unknown, _buffers?: ArrayBuffer[]) {
    throw new Error('MystAnyModel.send not implemented yet.');
  }
  get widget_manager() {
    throw new Error('MystAnyModel.widget_manager does not exist.');
  }
}
