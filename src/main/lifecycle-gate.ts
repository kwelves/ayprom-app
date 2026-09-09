export class LifecycleGate {
  private closing = false;

  beginShutdown() {
    this.closing = true;
  }

  isClosing() {
    return this.closing;
  }

  assertAcceptingWork() {
    if (this.closing) throw new Error("Приложение закрывается");
  }
}
