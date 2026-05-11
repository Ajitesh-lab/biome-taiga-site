(function () {
  const CONSENT_COOKIE = "biome_cookie_consent";
  const CONSENT_ACCEPTED = "analytics:accepted";
  const CONSENT_ESSENTIAL = "analytics:rejected";
  const GA_ID = "G-9155G0775X";
  const MAX_AGE = 60 * 60 * 24 * 180;

  function readCookie(name) {
    return document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(name + "="))
      ?.slice(name.length + 1) || "";
  }

  function writeConsent(value) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
  }

  function deleteCookie(name, domain) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    const domainPart = domain ? `; Domain=${domain}` : "";
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domainPart}`;
  }

  function clearAnalyticsCookies() {
    const names = document.cookie
      .split(";")
      .map((part) => part.trim().split("=")[0])
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    const domains = ["", location.hostname, "." + location.hostname, ".biomeai.uk"];
    names.forEach((name) => domains.forEach((domain) => deleteCookie(name, domain)));
  }

  function getConsent() {
    const raw = readCookie(CONSENT_COOKIE);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function loadAnalytics() {
    if (window.biomeAnalyticsLoaded) return;
    window.biomeAnalyticsLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });

    const queued = window.biomeAnalyticsEvents || [];
    queued.forEach((event) => {
      if (event && event.name) window.gtag("event", event.name, event.params || {});
    });
  }

  function applyConsent() {
    if (getConsent() === CONSENT_ACCEPTED) loadAnalytics();
  }

  function removeBanner() {
    document.getElementById("biome-cookie-banner")?.remove();
  }

  function setConsent(value) {
    writeConsent(value);
    removeBanner();
    if (value !== CONSENT_ACCEPTED) clearAnalyticsCookies();
    if (value === CONSENT_ACCEPTED) loadAnalytics();
  }

  function createBanner() {
    if (getConsent() || document.getElementById("biome-cookie-banner")) return;

    const banner = document.createElement("div");
    banner.id = "biome-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "true");
    banner.setAttribute("aria-labelledby", "biome-cookie-title");
    banner.setAttribute("aria-describedby", "biome-cookie-desc");
    banner.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:300",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:1rem",
      "background:rgba(10,14,10,0.46)",
      "backdrop-filter:blur(6px)",
      "color:#1a1c1a",
      "font-family:Helvetica,Arial,sans-serif"
    ].join(";");

    banner.innerHTML = `
      <div style="width:min(100%,560px);background:#ffffff;border:1px solid rgba(114,121,113,0.28);box-shadow:0 24px 70px rgba(0,0,0,0.24);padding:clamp(1.25rem,4vw,2rem);border-radius:6px">
        <div style="font-size:0.72rem;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#566342;margin-bottom:0.55rem">Cookie Preferences</div>
        <h2 id="biome-cookie-title" style="margin:0 0 0.75rem;color:#0c2c16;font-size:1.55rem;line-height:1.12;letter-spacing:-0.03em">Choose your cookies</h2>
        <p id="biome-cookie-desc" style="margin:0;color:#424842;font-size:0.94rem;line-height:1.62">Essential cookies keep sign-in, security, and your saved cookie choice working. With your permission, analytics cookies help us count visits and improve the website. We do not use advertising cookies.</p>

        <div style="display:grid;gap:0.75rem;margin:1.25rem 0">
          <div style="border:1px solid rgba(114,121,113,0.22);padding:0.85rem;background:#f9faf6;border-radius:4px">
            <div style="color:#0c2c16;font-size:0.82rem;font-weight:900;margin-bottom:0.2rem">Essential cookies</div>
            <p style="margin:0;color:#424842;font-size:0.82rem;line-height:1.5">Always on. Needed for sign-in, security, and remembering this choice.</p>
          </div>
          <div style="border:1px solid rgba(114,121,113,0.22);padding:0.85rem;background:#f9faf6;border-radius:4px">
            <div style="color:#0c2c16;font-size:0.82rem;font-weight:900;margin-bottom:0.2rem">Analytics cookies</div>
            <p style="margin:0;color:#424842;font-size:0.82rem;line-height:1.5">Optional. Helps us understand which pages people use so we can improve them.</p>
          </div>
        </div>

        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center">
          <button type="button" data-biome-cookie="${CONSENT_ESSENTIAL}" style="flex:1 1 190px;border:1px solid #0c2c16;background:#fff;color:#0c2c16;padding:0.85rem 1rem;font-size:0.78rem;font-weight:900;cursor:pointer;border-radius:4px">Accept essential only</button>
          <button type="button" data-biome-cookie="${CONSENT_ACCEPTED}" style="flex:1 1 190px;border:1px solid #0c2c16;background:#0c2c16;color:#fff;padding:0.85rem 1rem;font-size:0.78rem;font-weight:900;cursor:pointer;border-radius:4px">Accept all cookies</button>
        </div>
        <a href="/cookies.html" style="display:inline-block;margin-top:0.95rem;color:#0c2c16;font-size:0.8rem;font-weight:800;text-decoration:underline">Cookie policy and settings</a>
      </div>
    `;

    banner.addEventListener("click", (event) => {
      const value = event.target?.getAttribute?.("data-biome-cookie");
      if (value) setConsent(value);
    });

    document.body.appendChild(banner);
  }

  window.BiomeCookies = {
    acceptAnalytics: () => setConsent("analytics:accepted"),
    rejectAnalytics: () => setConsent("analytics:rejected"),
    getConsent,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyConsent();
      createBanner();
    });
  } else {
    applyConsent();
    createBanner();
  }
})();
