import * as THREE from "three";

/** Thin wrapper around THREE.WebGLRenderer: sizing, pixel ratio, color
 * management, and disposal in one place. */
export class Renderer {
  readonly webgl: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    this.webgl = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webgl.setSize(container.clientWidth, container.clientHeight);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.05;
    container.appendChild(this.webgl.domElement);
  }

  get domElement(): HTMLCanvasElement {
    return this.webgl.domElement;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webgl.render(scene, camera);
  }

  resize(width: number, height: number): void {
    this.webgl.setSize(width, height);
  }

  dispose(): void {
    this.webgl.dispose();
    this.webgl.domElement.remove();
  }
}
