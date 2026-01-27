Globale Produkte – Final (mit gemeinsamem Editor)
================================================

Diese Version ist für einen Webserver gedacht, damit ALLE die gleichen Änderungen sehen.

Wie es funktioniert
- Inhalte werden serverseitig in /data/site.json gespeichert.
- Die Website lädt Inhalte über GET /api/site.
- Speichern im Editor sendet PUT /api/site (Passwort geschützt).

Passwort
- Standard: 55
- Du kannst es als ENV setzen: EDITOR_PASSWORD=deinpasswort

Start lokal
1) ZIP entpacken
2) In den Ordner gehen
3) npm install
4) npm start
5) Öffnen: http://localhost:3000

Deployment (typisch)
- Upload auf einen Node.js-fähigen Server (VPS, Render, Railway, Heroku, etc.)
- Start command: npm start
- Port: nutzt process.env.PORT automatisch

Wichtig
- Das Passwort ist nur Header-based (x-editor-password) und nicht super-sicher.
  Für Schule/Projektwoche reicht es. Für öffentlich im Internet: Passwort ändern und ggf. IP/BasicAuth nutzen.

Dateien
- /public -> Frontend
- /data/site.json -> gemeinsame Inhalte
- server.js -> Backend