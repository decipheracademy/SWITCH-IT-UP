/** A mountable full-screen (or overlay) DOM UI unit. Screens are plain
 * DOM/CSS per the Project Foundation — Three.js is reserved for the
 * board/environment, not general UI chrome. */
export interface Screen {
  mount(root: HTMLElement): void;
  unmount(): void;
}
