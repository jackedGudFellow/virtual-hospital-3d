import * as THREE from 'three';
import { setWindowNightGlow } from './RoomBuilder';

/**
 * Clinical, calm daylight lighting rig for the virtual hospital scene.
 */
export class Lighting {
  public readonly group = new THREE.Group();
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly fillLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.group.name = 'lighting-rig';

    this.hemiLight = new THREE.HemisphereLight(0xf0f8ff, 0xbfd4e0, 0.85);
    this.hemiLight.position.set(0, 50, 0);
    this.group.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffdf8, 1.35);
    this.sunLight.position.set(28, 42, 24);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 140;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.group.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xd9eef8, 0.45);
    this.fillLight.position.set(-24, 18, -20);
    this.group.add(this.fillLight);

    scene.add(this.group);
  }

  setNightMode(night: boolean, scene: THREE.Scene): void {
    setWindowNightGlow(night);
    if (night) {
      scene.background = new THREE.Color(0x0f172a);
      scene.fog = new THREE.Fog(0x0f172a, 75, 220);
      this.hemiLight.color.setHex(0x334155);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.hemiLight.intensity = 0.75;
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.55;
      this.fillLight.color.setHex(0x38bdf8);
      this.fillLight.intensity = 0.35;
    } else {
      scene.background = new THREE.Color(0xe6f2f8);
      scene.fog = new THREE.Fog(0xe6f2f8, 80, 240);
      this.hemiLight.color.setHex(0xf0f8ff);
      this.hemiLight.groundColor.setHex(0xbfd4e0);
      this.hemiLight.intensity = 0.85;
      this.sunLight.color.setHex(0xfffdf8);
      this.sunLight.intensity = 1.35;
      this.fillLight.color.setHex(0xd9eef8);
      this.fillLight.intensity = 0.45;
    }
  }
}
