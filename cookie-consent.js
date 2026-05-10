(function () {
  const CONSENT_COOKIE = "biome_cookie_consent";
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
    if (getConsent() === "analytics:accepted") loadAnalytics();
  }

  function removeBanner() {
    document.getElementById("biome-cookie-banner")?.remove();
  }

  function setConsent(value) {
    writeConsent(value);
    removeBanner();
    if (value === "analytics:rejected") clearAnalyticsCookies();
    if (value === "analytics:accepted") loadAnalytics();
  }

  function createBanner() {
    if (getConsent() || document.getElementById("biome-cookie-banner")) return;

    const banner = document.createElement("div");
    banner.id = "biome-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie preferences");
    banner.style.cssText = [
      "position:fixed",
      "left:1rem",
      "right:1rem",
      "bottom:1rem",
      "z-index:300",
      "background:#ffffff",
      "color:#1a1c1a",
      "border:1px solid rgba(114,121,113,0.35)",
      "box-shadow:0 20px 50px rgba(0,0,0,0.16)",
      "padding:1rem",
      "max-width:680px",
      "margin:0 auto",
      "font-family:Helvetica,Arial,sans-serif"
    ].join(";");

    banner.innerHTML = `
      <div style="display:flex;gap:1rem;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
        <div style="flex:1 1 280px">
          <div style="font-size:0.75rem;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#0c2c16;margin-bottom:0.35rem">Cookies</div>
          <p style="margin:0;color:#424842;font-size:0.875rem;line-height:1.55">Biome uses essential cookies for sign-in and security. We only use Google Analytics if you allow analytics cookies.</p>
          <a href="/cookies.html" style="display:inline-block;margin-top:0.5rem;color:#0c2c16;font-size:0.8rem;font-weight:700;text-decoration:underline">Manage cookies</a>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="button" data-biome-cookie="analytics:rejected" style="border:1px solid #0c2c16;background:#fff;color:#0c2c16;padding:0.75rem 1rem;font-weight:800;cursor:pointer">Reject analytics</button>
          <button type="button" data-biome-cookie="analytics:accepted" style="border:1px solid #0c2c16;background:#0c2c16;color:#fff;padding:0.75rem 1rem;font-weight:800;cursor:pointer">Accept analytics</button>
        </div>
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
