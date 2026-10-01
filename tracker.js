"use strict";
/* Visit tracker - talks to the visitor server.
   Sends: a visit when the page opens, a "still here" ping every 15 s (active seconds + seconds per page),
   and - only after the visitor taps the opening screen - the browser's own location prompt (Allow / Block). */
(function () {
  // ✏️ Address of your visitor server, without a trailing slash.
  //    ""  = same address as this website (when the server also serves the site, e.g. local testing)
  //    e.g. "https://my-visitor-server.onrender.com" when the website lives on GitHub Pages
  const ENDPOINT = "";

  const PAGES = ["home", "balloons", "cake", "photos", "wishes", "letter"];
  const noop = () => {};
  window.Tracker = { requestLocation: noop };

  /* Owner switch: open the site once with ?notrack=1 on your own phone/laptop and your visits are never counted.
     (?notrack=0 turns counting back on.) */
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get("notrack") === "1") localStorage.setItem("bw_ignore", "1");
    if (qs.get("notrack") === "0") localStorage.removeItem("bw_ignore");
    if (localStorage.getItem("bw_ignore") === "1") return;
  } catch (e) { /* storage blocked - carry on */ }

  const uid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  // same browser = same visitor id, so repeat visits can be counted
  let visitorId;
  try {
    visitorId = localStorage.getItem("bw_vid");
    if (!visitorId) { visitorId = uid(); localStorage.setItem("bw_vid", visitorId); }
  } catch (e) { visitorId = uid(); }
  const visitId = uid();                     // new for every page load

  function send(type, data) {
    try {
      fetch(ENDPOINT + "/api/" + type, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },   // "simple" request: no CORS pre-flight
        body: JSON.stringify(Object.assign({ visitorId, visitId }, data)),
        keepalive: true, credentials: "omit", mode: "cors"
      }).catch(noop);
    } catch (e) { /* ignore */ }
  }

  const currentPage = () => {
    const h = (location.hash || "#home").slice(1);
    return PAGES.includes(h) ? h : "home";
  };

  /* 1) the visit itself */
  send("visit", {
    page: currentPage(),
    screen: screen.width + "x" + screen.height,
    viewport: innerWidth + "x" + innerHeight,
    language: navigator.language,
    timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone,
    referrer: document.referrer
  });

  /* 2) time on site: count seconds only while the tab is visible */
  let active = 0, dirty = false;
  const pages = {};
  setInterval(() => {
    if (document.hidden) return;
    active++;
    const p = currentPage();
    pages[p] = (pages[p] || 0) + 1;
    dirty = true;
  }, 1000);

  function beat() {
    if (!dirty) return;
    dirty = false;
    send("heartbeat", { active, pages });
  }
  setInterval(beat, 15000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { dirty = true; beat(); } });
  addEventListener("pagehide", () => { dirty = true; beat(); });

  /* 3) location - call once, right after the visitor taps the opening screen */
  let asked = false;
  window.Tracker.requestLocation = async function () {
    if (asked) return;
    asked = true;
    const report = (status, extra) => send("location", Object.assign({ status }, extra));

    if (!("geolocation" in navigator) || !window.isSecureContext) return report("unavailable");
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const st = await navigator.permissions.query({ name: "geolocation" });
        if (st.state === "denied") return report("denied");      // already blocked earlier - don't nag
      }
    } catch (e) { /* older browsers: just ask */ }

    navigator.geolocation.getCurrentPosition(
      pos => report("granted", { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => report(err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };
})();
