import "./styles/global.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Root element #app not found in index.html");
}

const app = new App(root);
app.start();
