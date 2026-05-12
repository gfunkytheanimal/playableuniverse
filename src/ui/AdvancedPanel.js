export class AdvancedPanel {
  constructor(root, params, hooks = {}) {
    this.root = root;
    this.params = params;
    this.hooks = hooks;
    this.body = root.querySelector('.panel-body');
    this.toggle = root.querySelector('.panel-toggle');
    this.toggle.addEventListener('click', () => {
      const collapsed = root.dataset.collapsed === 'true';
      root.dataset.collapsed = collapsed ? 'false' : 'true';
    });
    this._build();
  }

  _build() {
    this.body.innerHTML = '';
    this._section('Physics', [
      ['Force gain', 'forceGain', 0.2, 4.0, 0.05],
      ['Damping', 'damping', 0.9, 0.9999, 0.0005],
      ['Swirl bias', 'swirlBias', 0.0, 3.0, 0.05],
      ['Expansion', 'expansion', 0.0, 2.5, 0.05],
      ['Time scale', 'timeScale', 0.1, 3.0, 0.05],
      ['Origin strength', 'originStrength', 0.0, 2.0, 0.05]
    ]);
    this._section('Cosmology', [
      ['Audio reactivity', 'audioReactivity', 0.2, 4.0, 0.05],
      ['Memory persistence', 'memoryDecay', 0.985, 1.0, 0.0005],
      ['Memory blend', 'memoryBlend', 0.0, 2.0, 0.05],
      ['Spawn radius', 'spawnRadius', 20, 260, 2]
    ]);
    this._section('Visuals', [
      ['Point size', 'pointSize', 0.4, 8.0, 0.1],
      ['Bloom', 'bloomStrength', 0.0, 3.5, 0.05],
      ['Exposure', 'exposure', 0.3, 3.0, 0.05]
    ]);
    this._selectSection('Palette', 'palette', [
      ['Spectral wheel', 'spectral'],
      ['Cool void', 'cool'],
      ['Warm forge', 'warm'],
      ['Mono ghost', 'mono'],
      ['Plasma', 'plasma'],
      ['Aurora', 'aurora']
    ]);
    this._section('Synth', [
      ['Volume', 'synthVolume', 0.0, 1.0, 0.01],
      ['Cutoff', 'synthCutoff', 220, 9000, 20]
    ]);
    this._selectSection('Synth waveform', 'synthWaveform', [
      ['Triangle (warm)', 'triangle'],
      ['Sine (pure)', 'sine'],
      ['Sawtooth (bright)', 'sawtooth'],
      ['Square (hollow)', 'square']
    ]);
    this._actions([
      ['Recenter Camera', 'recenter'],
      ['Reset Universe', 'reset'],
      ['Clear Memory', 'clearMemory'],
      ['Clear Structures', 'clearStructures']
    ]);
  }

  _section(title, rows) {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';
    const h = document.createElement('h4');
    h.textContent = title;
    wrap.appendChild(h);
    for (const [label, key, min, max, step] of rows) {
      const row = document.createElement('div');
      row.className = 'panel-row';
      const lab = document.createElement('label');
      lab.textContent = label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = this.params[key];
      const value = document.createElement('span');
      value.className = 'value';
      value.textContent = format(this.params[key]);
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        this.params[key] = v;
        value.textContent = format(v);
        this.hooks.onParam?.(key, v);
      });
      row.appendChild(lab);
      row.appendChild(slider);
      row.appendChild(value);
      wrap.appendChild(row);
    }
    this.body.appendChild(wrap);
  }

  _selectSection(title, key, options) {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';
    const h = document.createElement('h4');
    h.textContent = title;
    wrap.appendChild(h);
    const row = document.createElement('div');
    row.className = 'panel-row';
    const lab = document.createElement('label');
    lab.textContent = title.split(' ')[0];
    const select = document.createElement('select');
    for (const [label, value] of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === this.params[key]) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      this.params[key] = select.value;
      this.hooks.onParam?.(key, select.value);
    });
    row.appendChild(lab);
    row.appendChild(select);
    wrap.appendChild(row);
    this.body.appendChild(wrap);
  }

  _actions(rows) {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';
    const h = document.createElement('h4');
    h.textContent = 'Actions';
    wrap.appendChild(h);
    for (const [label, key] of rows) {
      const row = document.createElement('div');
      row.className = 'panel-row';
      const btn = document.createElement('button');
      btn.className = 'panel-action';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => this.hooks.onAction?.(key));
      row.appendChild(btn);
      wrap.appendChild(row);
    }
    this.body.appendChild(wrap);
  }
}

function format(v) {
  if (typeof v === 'string') return v;
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
}
