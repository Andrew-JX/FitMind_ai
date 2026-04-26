import { createApp } from "./app.js";
import { loadServerEnv } from "./env.js";

const env = loadServerEnv();

const app = createApp();
const port = env.port;

app.listen(port, () => {
  console.log(`FitMind server listening on port ${port}`);
});
