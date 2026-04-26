import { createApp } from "./app.js";

const DEFAULT_PORT = 3001;

function getPort() {
  const value = Number(process.env.PORT);

  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return DEFAULT_PORT;
}

const app = createApp();
const port = getPort();

app.listen(port, () => {
  console.log(`FitMind server listening on port ${port}`);
});
