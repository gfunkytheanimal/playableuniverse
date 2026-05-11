export class DropZone {
  constructor(root, onFile) {
    this.root = root;
    this.onFile = onFile;
    this.input = root.querySelector('#file-input');
    this.root.addEventListener('click', () => this.input?.click());
    this.input?.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) this._consume(file);
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.root.dataset.state = 'hover';
    });
    window.addEventListener('dragleave', () => {
      this.root.dataset.state = 'idle';
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      this.root.dataset.state = 'idle';
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('audio/'));
      if (file) this._consume(file);
    });
  }

  _consume(file) {
    this.root.dataset.state = 'loaded';
    this.root.classList.add('dismissed');
    try { this.onFile(file); } catch (err) { console.error(err); }
  }
}
