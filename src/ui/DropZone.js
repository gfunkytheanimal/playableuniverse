export class DropZone {
  constructor({ overlay, button, input }, onFile) {
    this.overlay = overlay;
    this.button = button;
    this.input = input;
    this.onFile = onFile;
    this.dismissed = false;

    button?.addEventListener('click', () => this.input?.click());
    input?.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) this._consume(file);
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.overlay) this.overlay.dataset.state = 'hover';
    });
    window.addEventListener('dragleave', () => {
      if (this.overlay) this.overlay.dataset.state = 'idle';
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (this.overlay) this.overlay.dataset.state = 'idle';
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('audio/'));
      if (file) this._consume(file);
    });
  }

  dismissOverlay() {
    if (this.dismissed) return;
    this.dismissed = true;
    this.overlay?.classList.add('dismissed');
  }

  _consume(file) {
    this.dismissOverlay();
    try { this.onFile(file); } catch (err) { console.error(err); }
  }
}
