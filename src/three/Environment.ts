import * as THREE from "three";
import { PALETTE } from "./palette";

/**
 * Dresses the scene: background, lighting rig, a subtle holographic
 * floor grid, ambient particles, and slow-drifting rings. Deliberately
 * restrained per the visual direction — "futuristic educational
 * technology," not a nightclub.
 */
export class Environment {
  private scene: THREE.Scene;
  private floorGrid: THREE.GridHelper;
  private particles: THREE.Points;
  private rings: THREE.Mesh[] = [];
  private lights: THREE.Light[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    scene.background = new THREE.Color(PALETTE.background);
    scene.fog = new THREE.FogExp2(PALETTE.background, 0.045);

    this.lights = this.buildLights();
    this.lights.forEach((l) => scene.add(l));

    this.floorGrid = this.buildFloorGrid();
    scene.add(this.floorGrid);

    this.rings = this.buildRings();
    this.rings.forEach((r) => scene.add(r));

    this.particles = this.buildParticles();
    scene.add(this.particles);
  }

  private buildLights(): THREE.Light[] {
    const ambient = new THREE.AmbientLight(PALETTE.blue, 0.35);

    const keyCyan = new THREE.PointLight(PALETTE.cyan, 6, 20, 2);
    keyCyan.position.set(-3, 5, 4);

    const fillMagenta = new THREE.PointLight(PALETTE.magenta, 4, 20, 2);
    fillMagenta.position.set(4, 3, -3);

    const accentOrange = new THREE.PointLight(PALETTE.orange, 1.4, 14, 2);
    accentOrange.position.set(0, 2, 5);

    const rim = new THREE.DirectionalLight(PALETTE.purple, 0.5);
    rim.position.set(-2, 6, -4);

    return [ambient, keyCyan, fillMagenta, accentOrange, rim];
  }

  private buildFloorGrid(): THREE.GridHelper {
    const grid = new THREE.GridHelper(40, 40, PALETTE.blue, PALETTE.blue);
    grid.position.y = -2.4;
    const mat = grid.material as THREE.Material & { opacity: number; transparent: boolean };
    mat.opacity = 0.12;
    mat.transparent = true;
    return grid;
  }

  private buildRings(): THREE.Mesh[] {
    const rings: THREE.Mesh[] = [];
    const configs = [
      { radius: 7, color: PALETTE.cyan, y: -2.35, opacity: 0.18 },
      { radius: 9.5, color: PALETTE.purple, y: -2.3, opacity: 0.1 },
    ];
    for (const cfg of configs) {
      const geo = new THREE.RingGeometry(cfg.radius - 0.03, cfg.radius, 128);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = cfg.y;
      rings.push(mesh);
    }
    return rings;
  }

  private buildParticles(): THREE.Points {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 10 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: PALETTE.cyan,
      size: 0.03,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
    });
    return new THREE.Points(geometry, material);
  }

  update(delta: number, elapsed: number): void {
    this.rings.forEach((ring, i) => {
      ring.rotation.z += delta * (i === 0 ? 0.02 : -0.012);
    });
    this.particles.rotation.y += delta * 0.01;
    // Gentle vertical drift on the particle field.
    this.particles.position.y = Math.sin(elapsed * 0.15) * 0.15;
  }

  dispose(): void {
    this.floorGrid.geometry.dispose();
    (this.floorGrid.material as THREE.Material).dispose();
    this.rings.forEach((r) => {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
      this.scene.remove(r);
    });
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
    this.scene.remove(this.particles);
    this.lights.forEach((l) => this.scene.remove(l));
  }
}
