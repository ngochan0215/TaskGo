/**
 * Static file server for frontend deploy (e.g. Render).
 * Serves templates, public, components, src and handles root redirect.
 * Use API_URL env (e.g. https://taskgo-e2jw.onrender.com) for backend.
 */
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const API_BASE = process.env.API_URL || "http://localhost:3000";
const escapedApiBase = API_BASE.replace(/"/g, '\\"');

// Dynamic config: override /templates/js/config.js so frontend uses API_URL in production
app.get("/templates/js/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(
    `const CONFIG = { API_BASE_URL: "${API_BASE.replace(/"/g, '\\"')}" };`
  );
});

// Inject CONFIG into every HTML so all pages get API_BASE_URL without editing each file
function injectConfigAndSend(req, res, filePath) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.redirect("/templates/auth/login-signup.html");
      return;
    }
    const script = `<script>window.CONFIG={API_BASE_URL:"${escapedApiBase}"};var CONFIG=window.CONFIG;</script>`;
    const injected = data.replace(/<head>/i, `<head>\n    ${script}`);
    res.type("html").send(injected);
  });
}
app.get(/^\/templates\/.+\.html$/, (req, res) => {
  injectConfigAndSend(req, res, path.join(__dirname, req.path));
});
app.get(/^\/src\/.+\.html$/, (req, res) => {
  injectConfigAndSend(req, res, path.join(__dirname, req.path));
});

// Static folders (paths match relative links in HTML like ../../public, ../../components)
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/templates", express.static(path.join(__dirname, "templates")));
app.use("/components", express.static(path.join(__dirname, "components")));
app.use("/src", express.static(path.join(__dirname, "src")));

// Root and index.html: redirect to login page
app.get("/", (req, res) => {
  res.redirect("/templates/auth/login-signup.html");
});
app.get("/index.html", (req, res) => {
  res.redirect("/templates/auth/login-signup.html");
});

// Fallback for unknown routes -> redirect to login (avoid "cannot GET")
app.use((req, res) => {
  res.redirect("/templates/auth/login-signup.html");
});

app.listen(PORT, () => {
  console.log(`TaskGo frontend at http://localhost:${PORT} (API: ${API_BASE})`);
});
