import * as THREE from "three";
import type { PanState } from "../core/GameState";

/**
 * Manages a perspective camera framed for a top-down-ish board view
 * with enough tilt/depth to read as a 3D holographic device rather than
 * a flat overhead diagram.
 *
 * Framing is computed continuously from the container's actual usable
 * area (viewport minus the HUD's reserved top/bottom strips) rather
 * than a binary "narrow vs. wide" switch.
 *
 * MOBILE PANNING (Build 01 final correction): cells are a fixed
 * physical size (see three/BoardScene.ts), so a large board (9x9) can
 * be wider than the viewport can show at a readable scale. Rather than
 * shrinking cells to force a fit, the camera can truck sideways
 * (position.x and the look-at target move together) between a
 * computed min/max pan range, revealing the rest of the board. The
 * board geometry itself never moves.
 */
export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;
  private container: HTMLElement;

  private boardWidth = 3; // updated via setBoardWidth() once the real board is known
  private visibleWidth = 1;
  private panRange = 0;
  private panEnabled = false;
  private panX = 0;
  private panTargetX = 0;
  private lookZ = 0.4;

  constructor(container: HTMLElement) {
    this.container = container;
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.applyFraming();
  }

  /** Called whenever the active board changes (see SceneManager, which
   * reads BoardScene.getBoardWidth() after a "board:rebuilt" event). */
  setBoardWidth(width: number): void {
    this.boardWidth = width;
    this.recomputePanRange();
    this.applyPan();
  }

  getPanState(): PanState {
    return { enabled: this.panEnabled, range: this.panRange, x: this.panX };
  }

  /** Sets an absolute pan target (world units), clamped to the current
   * range. Used by touch-drag (immediate — see setPanImmediate) and by
   * the on-screen pan controller (smoothed — see update()). */
  setPanTarget(x: number): void {
    this.panTargetX = THREE.MathUtils.clamp(x, -this.panRange, this.panRange);
  }

  /** Sets pan position immediately with no smoothing — used during an
   * active touch/pointer drag, where 1:1 tracking feels correct and any
   * lag would feel laggy/wrong. */
  setPanImmediate(x: number): void {
    this.panX = THREE.MathUtils.clamp(x, -this.panRange, this.panRange);
    this.panTargetX = this.panX;
    this.applyPan();
  }

  getPanX(): number {
    return this.panX;
  }

  getPanRange(): number {
    return this.panRange;
  }

  isPanEnabled(): boolean {
    return this.panEnabled;
  }

  /** World units visible across the viewport width at the board's
   * surface, at the current framing (pan-independent — see
   * recomputePanRange). Used by InputManager to convert a drag's pixel
   * delta into a world-space pan delta. */
  getVisibleWidth(): number {
    return this.visibleWidth;
  }

  /** Advances pan smoothing toward panTargetX. Called once per frame
   * from SceneManager's render loop. Button-driven pan nudges glide via
   * this; drag-driven pan uses setPanImmediate and skips the glide. */
  update(delta: number): void {
    if (!this.panEnabled) return;
    if (Math.abs(this.panTargetX - this.panX) < 0.0005) return;
    const t = 1 - Math.exp(-delta * 10);
    this.panX = THREE.MathUtils.lerp(this.panX, this.panTargetX, t);
    this.applyPan();
  }

  private applyFraming(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);

    // Reserve space for the HUD's top/bottom bars (see styles/global.css
    // .hud-top / .hud-bottom / .pan-controller) so the board is framed
    // within the area actually available to it, not the full viewport.
    // Below the 700px breakpoint the HUD's bottom bar switches to a
    // stacked column (palette above Trace Back) and may also show the
    // pan controller, both taller, so that case reserves more space.
    const isStackedHud = width < 700;
const reservedTop = height < 500 ? 56 : 64;

const reservedBottom = isStackedHud
  ? height < 700
    ? 285
    : 235
  : height < 500
    ? 96
    : 120;
    const usableHeight = Math.max(height - reservedTop - reservedBottom, height * 0.4);
    const usableAspect = width / usableHeight;

    const baseFov = 42;
    const baseDistanceY = 7.0;
    const baseDistanceZ = 6.2;

    // On portrait/narrow viewports the usable area is taller than it is
    // wide. Pulling the camera back (rather than only widening the FOV)
    // keeps the board's horizontal extent from clipping. These
    // constants were tuned numerically (see dev notes) against real
    // THREE.js projection math across common phone/tablet viewports so
    // that boards up to 6x6 fit comfortably without panning, while 9x9
    // triggers panning on phones/portrait tablets as intended — not
    // sooner, and not only on extreme sizes.
    const portraitFactor = usableAspect < 1 ? Math.min(1 / usableAspect, 4.6) : 1;
    const distanceScale = 0.9 + portraitFactor * 0.72;

    this.camera.position.set(0, baseDistanceY * distanceScale, baseDistanceZ * distanceScale);
    this.camera.fov = Math.min(baseFov + (portraitFactor - 1) * 3, 56);
    this.lookZ = usableAspect < 1 ? 0.9 : 0.4;
    this.camera.lookAt(0, 0, this.lookZ);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);

    this.visibleWidth = this.computeVisibleWidthAtBoardPlane();
    this.recomputePanRange();
    this.applyPan();
  }

  /** Unprojects the left/right edges of the viewport (at screen-center
   * height) onto the board's y=0 plane to find how many world units are
   * actually visible there — an accurate measure given the camera's
   * tilt, computed at panX=0 so it's reusable regardless of current pan
   * (panning translates the whole rig sideways without changing the
   * frustum shape). */
  private computeVisibleWidthAtBoardPlane(): number {
    const unprojectOnY0 = (ndcX: number): THREE.Vector3 => {
      const near = new THREE.Vector3(ndcX, 0, -1).unproject(this.camera);
      const far = new THREE.Vector3(ndcX, 0, 1).unproject(this.camera);
      const dir = far.clone().sub(near);
      const t = dir.y !== 0 ? -near.y / dir.y : 0;
      return near.clone().addScaledVector(dir, t);
    };
    const left = unprojectOnY0(-1);
    const right = unprojectOnY0(1);
    return Math.abs(right.x - left.x);
  }

  private recomputePanRange(): void {
    // Safety margin so panning only activates for a genuine overflow,
    // not a few rounding pixels — the board should use the full
    // available width comfortably before panning kicks in.
    const safetyMargin = 0.94;
    const overflow = this.boardWidth - this.visibleWidth * safetyMargin;
    this.panRange = Math.max(0, overflow / 2);
    this.panEnabled = this.panRange > 0.03;
    if (!this.panEnabled) {
      this.panX = 0;
      this.panTargetX = 0;
    } else {
      this.panX = THREE.MathUtils.clamp(this.panX, -this.panRange, this.panRange);
      this.panTargetX = THREE.MathUtils.clamp(this.panTargetX, -this.panRange, this.panRange);
    }
  }

  private applyPan(): void {
    this.camera.position.x = this.panX;
    this.camera.lookAt(this.panX, 0, this.lookZ);
    this.camera.updateMatrixWorld(true);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.applyFraming();
  }
}
