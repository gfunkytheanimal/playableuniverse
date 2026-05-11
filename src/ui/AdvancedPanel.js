export class AdvancedPanel {
  constructor(root, params) {
    this.root = root;
    this.params = params;
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
      ['Force gain', 'forceGain', 0.2, 3.0, 0.05],
      ['Damping', 'damping', 0.9, 0.999, 0.001],
      ['Swirl bias', 'swirlBias', 0.0, 2.0, 0.05],
      ['Time scale', 'timeScale', 0.2, 2.5, 0.05]
    ]);
    this._section('Visuals', [
      ['Point size', 'pointSize', 0.6, 6.0, 0.1],
      ['Bloom', 'bloomStrength', 0.0, 3.0, 0.05],
      ['Exposure', 'exposure', 0.4, 2.4, 0.05],
      ['Memory blend', 'memoryBlend', 0.0, 2.0, 0.05]
    ]);
    this._section('Cosmology', [
      ['Audio reactivity', 'audioReactivity', 0.2, 3.0, 0.05],
      ['Memory decay', 'memoryDecay', 0.985, 1.0, 0.0005],
      ['Spawn radius', 'spawnRadius', 20, 220, 2]
    ]);
    this._selectSection('Palette', 'palette', [
      ['Spectral wheel', 'spectral'],
      ['Cool void', 'cool'],
      ['Warm forge', 'warm'],
      ['Mono ghost', 'mono']
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
    lab.textContent = 'Palette';
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
    });
    row.appendChild(lab);
    row.appendChild(select);
    wrap.appendChild(row);
    this.body.appendChild(wrap);
  }
}

function format(v) {
  if (Math.abs(v) >= 10) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
