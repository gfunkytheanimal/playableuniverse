import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class StructureLoader {
  constructor(scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.objects = [];
    this.group = new THREE.Group();
    this.group.name = 'imported-structures';
    this.scene.add(this.group);
  }

  isSupported(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.glb') || name.endsWith('.gltf') || file.type === 'model/gltf-binary' || file.type === 'model/gltf+json';
  }

  async loadFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });
      const obj = gltf.scene || gltf.scenes?.[0];
      if (!obj) throw new Error('GLTF contained no scene.');
      this._normalize(obj);
      this.group.add(obj);
      this.objects.push(obj);
      return obj;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  _normalize(obj) {
    // Re-centre + rescale so the asset fits inside the particle volume
    // regardless of how the artist exported it.
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 90;
    const scale = target / maxDim;
    obj.scale.setScalar(scale);
    obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    // Make sure materials don't fight the additive particle layer.
    obj.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          if ('transparent' in m) m.transparent = true;
          if ('depthWrite' in m) m.depthWrite = false;
          if ('opacity' in m && m.opacity === 1) m.opacity = 0.62;
        }
      }
    });
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      this.group.remove(child);
    }
    this.objects.length = 0;
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
