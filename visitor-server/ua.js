// Small User-Agent parser (no dependency). Browsers only reveal a rough device
// (mobile/tablet/desktop + OS + browser). An exact phone model is only sometimes present.

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|twitterbot|linkedin|discord|slack|skype|preview|curl|wget|python|httpclient|okhttp|headless|lighthouse|pingdom|uptime|monitor|axios|node-fetch|go-http/i;

const BROWSERS = [
  ["Instagram app", /Instagram/],
  ["Facebook app", /FB_IAB|FBAN|FBAV/],
  ["Snapchat app", /Snapchat/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
  ["Safari", /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/]
];

export function parseUA(raw = "") {
  const ua = String(raw).slice(0, 400);

  let browser = "Unknown";
  for (const [name, re] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = m[1] ? `${name} ${m[1]}` : name; break; }
  }

  let os = "Unknown";
  let m;
  if ((m = ua.match(/Windows NT ([\d.]+)/))) os = "Windows " + ({ "10.0": "10/11", "6.3": "8.1", "6.1": "7" }[m[1]] || m[1]);
  else if ((m = ua.match(/Android (\d+)/))) os = "Android " + m[1];
  else if ((m = ua.match(/iPhone OS (\d+)/))) os = "iOS " + m[1];
  else if ((m = ua.match(/CPU OS (\d+)/)) && /iPad/.test(ua)) os = "iPadOS " + m[1];
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let deviceType = "desktop";
  if (/iPad|Tablet|Tab\b/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) deviceType = "tablet";
  else if (/Mobi|iPhone|Android/i.test(ua)) deviceType = "mobile";

  let deviceModel = null;
  if (/iPhone/.test(ua)) deviceModel = "iPhone";
  else if (/iPad/.test(ua)) deviceModel = "iPad";
  else if ((m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\)|;)/))) {
    const model = m[1].trim();
    // Chrome hides the model and shows a single letter "K" - treat that as unknown.
    if (model.length > 1 && !/^K$/i.test(model)) deviceModel = model.slice(0, 40);
  }

  return { isBot: !ua || BOT_RE.test(ua), browser, os, deviceType, deviceModel };
}
