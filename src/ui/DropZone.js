export class DropZone {
  constructor({ overlay, button, input, structureButton, structureInput }, { onAudio, onStructure }) {
    this.overlay = overlay;
    this.button = button;
    this.input = input;
    this.structureButton = structureButton;
    this.structureInput = structureInput;
    this.onAudio = onAudio;
    this.onStructure = onStructure;
    this.dismissed = false;

    button?.addEventListener('click', () => this.input?.click());
    input?.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) this._consume(file);
    });
    structureButton?.addEventListener('click', () => this.structureInput?.click());
    structureInput?.addEventListener('change', () => {
      const file = this.structureInput.files?.[0];
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
      const files = [...(e.dataTransfer?.files ?? [])];
      for (const file of files) this._consume(file);
    });
  }

  dismissOverlay() {
    if (this.dismissed) return;
    this.dismissed = true;
    this.overlay?.classList.add('dismissed');
  }

  _consume(file) {
    this.dismissOverlay();
    const name = (file.name || '').toLowerCase();
    const isModel = name.endsWith('.glb') || name.endsWith('.gltf') || file.type === 'model/gltf-binary' || file.type === 'model/gltf+json';
    try {
      if (isModel && this.onStructure) this.onStructure(file);
      else if (file.type.startsWith('audio/') && this.onAudio) this.onAudio(file);
      else if (this.onAudio) this.onAudio(file);
    } catch (err) {
      console.error(err);
    }
  }
}
