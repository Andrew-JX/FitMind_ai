let appPromise;

export default async function handler(request, response) {
  if (!appPromise) {
    appPromise = import("../server/dist/app.js").then(({ createApp }) =>
      createApp(),
    );
  }

  const app = await appPromise;

  return app(request, response);
}
