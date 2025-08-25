import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import * as path from "path";

const app = new Hono();

app.use("*", cors());
app.use(logger());
app.use("*", requestId());

app.use(
  "*",
  basicAuth({
    username: process.env.PAGE_USERNAME!,
    password: process.env.PAGE_PASSWORD!,
  })
);

app.get("/api/test", (c) => {
  return c.text("Hello Hono!");
});

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
