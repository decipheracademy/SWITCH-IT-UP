import { GameState, type AppScreen } from "../core/GameState";
import { SceneManager } from "../core/SceneManager";
import { AssetManager } from "../core/AssetManager";
import { InputManager } from "../input/InputManager";
import { AudioManager } from "../audio/AudioManager";
import type { Screen } from "../ui/Screen";
import { LoaderScreen } from "../ui/screens/LoaderScreen";
import { HomeScreen } from "../ui/screens/HomeScreen";
import { HowToPlayScreen } from "../ui/screens/HowToPlayScreen";
import { PlayerSetupScreen } from "../ui/screens/PlayerSetupScreen";
import { GradeSelectScreen } from "../ui/screens/GradeSelectScreen";
import { CountdownScreen } from "../ui/screens/CountdownScreen";
import { GameHUD } from "../ui/screens/GameHUD";
import { ResultsScreen } from "../ui/screens/ResultsScreen";
import { LeaderboardScreen } from "../ui/screens/LeaderboardScreen";

/**
 * App is the composition root. It creates the long-lived systems once
 * (GameState, SceneManager, InputManager, AudioManager, AssetManager)
 * and swaps lightweight DOM Screen instances in response to
 * GameState's "screen:change" events. The 3D scene stays mounted and
 * running continuously — only the board's visibility toggles — so
 * navigation never tears down or re-initializes WebGL state.
 */
export class App {
  private gameState: GameState;
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private audioManager: AudioManager;
  private assetManager: AssetManager;

  private uiRoot: HTMLElement;
  private screens: Record<AppScreen, Screen>;
  private activeScreen: Screen | null = null;

  constructor(rootEl: HTMLElement) {
    rootEl.innerHTML = "";
    rootEl.classList.add("app-root");

    const sceneContainer = document.createElement("div");
    sceneContainer.className = "scene-container";
    rootEl.appendChild(sceneContainer);

    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "ui-root";
    rootEl.appendChild(this.uiRoot);

    this.gameState = new GameState();
    this.assetManager = new AssetManager();
    this.audioManager = new AudioManager();
    this.sceneManager = new SceneManager(sceneContainer, this.gameState);
    this.inputManager = new InputManager(
      this.sceneManager.renderer.domElement,
      this.sceneManager,
      this.gameState
    );

    this.screens = {
      loader: new LoaderScreen(this.gameState),
      home: new HomeScreen(this.gameState, this.audioManager),
      "how-to-play": new HowToPlayScreen(this.gameState, this.audioManager),
      "player-setup": new PlayerSetupScreen(this.gameState, this.audioManager),
      "grade-select": new GradeSelectScreen(this.gameState, this.audioManager),
      countdown: new CountdownScreen(this.gameState, this.audioManager),
      game: new GameHUD(this.gameState, this.audioManager, this.sceneManager),
      results: new ResultsScreen(this.gameState, this.audioManager),
      leaderboard: new LeaderboardScreen(this.gameState, this.audioManager),
    };

    this.gameState.bus.on("screen:change", ({ screen }) => this.renderScreen(screen));
  }

  start(): void {
    this.sceneManager.start();
    this.renderScreen(this.gameState.screen);
  }

  private renderScreen(screen: AppScreen): void {
    this.activeScreen?.unmount();
    this.uiRoot.innerHTML = "";
    this.uiRoot.className = `ui-root screen-${screen}`;

    this.sceneManager.boardScene.setVisible(screen === "game");

    const next = this.screens[screen];
    next.mount(this.uiRoot);
    this.activeScreen = next;
  }

  /** For debugging/testing convenience only — not part of gameplay. */
  getAssetManager(): AssetManager {
    return this.assetManager;
  }

  dispose(): void {
    this.activeScreen?.unmount();
    this.inputManager.dispose();
    this.sceneManager.dispose();
  }
}
