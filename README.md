# Birthday-site visitor server

A tiny Node.js server (no npm packages) that:

* counts visits and **repeat visits** of the same visitor (random visitor ID kept in the browser),
* measures **time on site** and time on each page (only while the tab is visible),
* records **IP address**, approximate **city / country** (from the IP), **device, OS, browser**,
* records the result of the browser's **location prompt** (Allow / Block) and the GPS position if allowed,
* shows everything on a **password-protected dashboard** (`/admin`) with a map, and can export **CSV**.

Needs **Node.js 22.13 or newer** (it uses Node's built-in SQLite).

---------------------------------------------------------------------

## 1. Try it on your computer (2 minutes)

```bash
cd visitor-server
cp .env.example .env        # then open .env and set ADMIN_PASSWORD
npm start
```

* Website (served by the same server for testing): http://localhost:3000
* Dashboard: http://localhost:3000/admin  (user `admin`, password from `.env`)

Open the website, tap the gift screen, click around, then look at the dashboard.
Location only works on `https://` or `localhost`, so test on localhost, not by opening index.html as a file.

**Don't count your own visits:** open your site once with `?notrack=1` on the end
(`http://localhost:3000/?notrack=1`) on every phone/laptop you own. Use `?notrack=0` to switch counting back on.

---------------------------------------------------------------------

## 2. Put it online

The website goes on **GitHub Pages** (static). This server must run somewhere else, because GitHub Pages cannot run Node.

### a) Deploy the server (example: Render.com)
1. Put the `visitor-server` folder in its own GitHub repo. (`.gitignore` already keeps `.env` and `data/` out.)
2. Render -> New -> **Web Service** -> pick the repo.
   * Runtime: Node   * Build command: *(leave empty)*   * Start command: `npm start`
3. Add these **Environment variables**:

| Name | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `ADMIN_USER` | a name of your choice |
| `ADMIN_PASSWORD` | a long password |
| `ALLOWED_ORIGINS` | `https://YOUR-GITHUB-USERNAME.github.io` (no path, no trailing slash) |
| `TRUST_PROXY` | `true` |
| `PROXY_HOPS` | `1` |
| `SITE_DIR` | *(empty)* |
| `IP_MODE` | `raw` or `hashed` (see privacy below) |
| `IP_SALT` | any long random text |

4. After it deploys you get a URL like `https://something.onrender.com`. Open `/health` on it - you should see `{"ok":true}`.

### b) Connect the website to the server
In `birthday-site/tracker.js` change the first setting:

```js
const ENDPOINT = "https://something.onrender.com";   // no trailing slash
```

Then push the `birthday-site` folder to a GitHub repo and turn on **Settings -> Pages** (branch `main`, folder `/root`).

### c) Check it
Open the website, then `https://something.onrender.com/admin`. Your visit should appear.
If the IP column shows an address that is not yours (looks like a Cloudflare/Render address), change `PROXY_HOPS` to `2`.

### Keep your identity private
GitHub Pages links contain your GitHub username, and Render links contain your service name.
Use neutral names (or a separate account) if she must not be able to work out who made the site.

---------------------------------------------------------------------

## 3. Important: where the data is stored

Data lives in one SQLite file (`data/visitors.db`).
**On Render's free plan the disk is wiped on every redeploy/restart**, so the history would disappear.
Choose one:

* Download the CSV from the dashboard regularly (button top-right), or
* use a host with a persistent volume (Render "Disk" - paid, Fly.io or Railway volumes), and set `DB_PATH` to a path on that volume, or
* run the server on your own PC and expose it with a Cloudflare Tunnel.

Free Render services also "fall asleep" when nobody visits, so the first visit after a quiet period can be slow (the site still works; tracking just arrives a few seconds late).

---------------------------------------------------------------------

## 4. Privacy (please read)

IP address and location are personal data. Simple rules that keep this fair and legal-friendly:

* The opening screen already says *"This page counts visits and may ask for your location."* Keep that line.
* GPS is only ever asked through the **browser's own Allow / Block prompt**; nothing is stored if she blocks it, and it is never asked again once blocked.
* Set `IP_MODE=hashed` if you don't need to see the real address: repeat visits still work, but the IP itself is not stored.
* `GPS_DECIMALS=3` keeps GPS to about 100 m (`2` = about 1 km) instead of about 1 m.
* Keep the dashboard password long and private. It only works over HTTPS when deployed (Render provides it).
* To delete everything: stop the server and delete `data/visitors.db`.

---------------------------------------------------------------------

## 5. What is (and isn't) possible

* **Device name:** browsers only reveal device type + OS + browser. A phone model like `SM-A546E` appears only on some Android browsers; iPhones show just "iPhone".
* **IP city:** approximate, often the mobile operator's hub, sometimes a different city.
* **Same visitor:** recognised by an ID in the browser. Clearing site data, private mode or another device counts as a new visitor.
* **Bots / link previews** (WhatsApp, Telegram, crawlers) are stored separately and not counted.

## 6. Files

| File | Purpose |
|---|---|
| `server.js` | HTTP server, tracking endpoints, dashboard login, CSV export |
| `db.js` | SQLite tables |
| `ua.js` | reads browser / OS / device from the User-Agent |
| `geo.js` | IP -> city / country lookup (free ipwho.is, cached 30 days) |
| `dashboard.html` | the private dashboard |
| `.env.example` | all settings, explained |

API (used by `tracker.js`): `POST /api/visit`, `POST /api/heartbeat`, `POST /api/location`.
Dashboard: `GET /admin`, `GET /admin/api/stats`, `GET /admin/export.csv` (all need the login).
