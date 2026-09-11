import * as THREE from "three";
import { CameraManager } from "../three/CameraManager";
import { Renderer } from "../three/Renderer";
import { Environment } from "../three/Environment";
import { BoardScene } from "../three/BoardScene";
import type { GameState } from "./GameState";

/**
 * SceneManager owns the Three.js lifecycle: renderer, camera, scene
 * graph, resize handling, and the animation loop. It delegates
 * environment dressing to Environment and board presentation to
 * BoardScene, so this class stays a thin coordinator.
 *
 * It's also the mediator between BoardScene (which knows the current
 * board's real-world width) and CameraManager (which decides, from
 * that width and the viewport, whether mobile panning is needed) —
 * and it forwards CameraManager's pan state to GameState's event bus so
 * DOM UI (the pan controller) can react without touching Three.js.
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly cameraManager: CameraManager;
  readonly renderer: Renderer;
  readonly environment: Environment;
  readonly boardScene: BoardScene;

  private gameState: GameState;
  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, gameState: GameState) {
    this.container = container;
    this.gameState = gameState;
    this.scene = new THREE.Scene();
    this.renderer = new Renderer(container);
    this.cameraManager = new CameraManager(container);
    this.environment = new Environment(this.scene);
    this.boardScene = new BoardScene(this.scene, gameState);

    // BoardScene has already built the initial board by this point (its
    // constructor runs synchronously above), so its width is known.
    this.cameraManager.setBoardWidth(this.boardScene.getBoardWidth());
    this.emitPanState();

    gameState.bus.on("board:rebuilt", () => {
      this.cameraManager.setBoardWidth(this.boardScene.getBoardWidth());
      this.emitPanState();
    });

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("orientationchange", this.handleResize);
    // ResizeObserver catches layout-driven size changes to the
    // container itself (not just window-level resizes), which is more
    // reliable across mobile browsers than window "resize" alone —
    // particularly for orientation changes where the URL bar
    // show/hide can change the container size without a window resize.
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  /** Pans the camera to an absolute world-space position immediately,
   * with no smoothing — used for touch/pointer drag, where 1:1 tracking
   * is what feels correct and any lag would feel wrong. */
  panCameraAbsolute(x: number): void {
    this.cameraManager.setPanImmediate(x);
    this.emitPanState();
  }

  /** Sets a pan target that the render loop glides toward smoothly —
   * used by the on-screen pan controller's buttons/slider. */
  panCameraTo(x: number): void {
    this.cameraManager.setPanTarget(x);
  }

  /** World units visible per horizontal pixel of the canvas at the
   * current framing — used by InputManager to convert a drag gesture's
   * pixel delta into a world-space pan delta. */
  getWorldUnitsPerPixel(): number {
    const width = this.container.clientWidth || 1;
    return this.cameraManager.getVisibleWidth() / width;
  }

  private emitPanState(): void {
    this.gameState.bus.emit("camera:pan", this.cameraManager.getPanState());
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      const beforeX = this.cameraManager.getPanX();
      this.cameraManager.update(delta);
      if (this.cameraManager.isPanEnabled() && this.cameraManager.getPanX() !== beforeX) {
        this.emitPanState();
      }
      this.environment.update(delta, elapsed);
      this.boardScene.update(delta, elapsed);
      this.renderer.render(this.scene, this.cameraManager.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.cameraManager.resize(width, height);
    this.renderer.resize(width, height);
    this.emitPanState();
  };

  /** Full teardown — disposes GPU resources to avoid leaks when the
   * game screen is torn down (e.g. navigating back to Home). */
  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleResize);
    this.resizeObserver.disconnect();
    this.boardScene.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
