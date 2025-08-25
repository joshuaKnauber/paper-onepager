import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import * as path from "path";

const app = new Hono();

app.use(
  "*",
  basicAuth({
    username: "jknauber",
    password: "madeforpaper",
  })
);

app.get("/api/test", (c) => {
  return c.text("Hello Hono!");
});

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
