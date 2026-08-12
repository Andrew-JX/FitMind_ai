import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  // The deploy pipeline compares this against the commit it just activated. A
  // 200 alone cannot distinguish a new release from the previous one still
  // serving traffic, so liveness and release identity are reported together.
  const release = process.env.FITMIND_RELEASE_SHA?.trim();

  response.status(200).json({
    ok: true,
    data: {
      status: "ok",
      release: release ? release : null,
    },
  });
});
