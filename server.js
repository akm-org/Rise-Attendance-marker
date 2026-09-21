const http = require("node:http");

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    });
    res.end(JSON.stringify({
      status: "online",
      service: "discord-attendance-bot",
      gateway: "diagnostic-v20"
    }));
    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Render Web Service listening on 0.0.0.0:${PORT}`);
});

module.exports = server;
