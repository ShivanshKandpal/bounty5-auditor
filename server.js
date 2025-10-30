// server.js - HTTP server for the approval risk auditor agent
import { serve } from '@hono/node-server';
import app from "./agent.js";

const port = process.env.PORT || 8080;

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`Agent server listening on http://localhost:${info.port}`);
});