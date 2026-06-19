/**
 * Effectime Embed Widget — Web Component
 * Beágyazás: <effectime-embed token="…" views="…"></effectime-embed>
 * + <script src="https://effectime.app/embed.js" defer></script>
 *
 * Attribútumok:
 *   token   — kötelező, embed token
 *   views   — vesszővel elválasztott nézetek (pl. capacity_planner,shift_roster)
 *   height  — iframe magasság px-ben, alapértelmezett: 500
 *   lang    — nyelv, alapértelmezett: hu
 *   label   — fejléc felirat, alapértelmezett: "kapacitás & beosztás"
 *   office  — opcionális telephely UUID szűrő
 *   member  — opcionális user UUID (member_schedule nézethez kötelező)
 *   mode    — capacity_planner: "weekly" | "monthly" (default: weekly)
 */
(function () {
  'use strict';

  const BASE_URL = 'https://effectime.app';

  const CSS = `
    :host { display: block; max-width: 100%; }
    *, *::before, *::after { box-sizing: border-box; }

    .w {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 30px -12px rgba(15,23,42,.14), 0 2px 6px -2px rgba(15,23,42,.06);
      padding: 16px;
      color: #0f172a;
    }
    .stripe {
      height: 3px;
      border-radius: 3px;
      background: linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #22c55e 100%);
      margin-bottom: 14px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 2px 12px;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      box-shadow: 0 4px 10px rgba(59,130,246,.35);
      color: #fff;
      font-weight: 700;
      font-size: 13px;
    }
    .brand { font-weight: 700; font-size: 14px; color: #0f172a; }
    .sub   { font-size: 11px; color: #64748b; font-weight: 500; }
    .live  {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #15803d;
      font-weight: 600;
      background: rgba(34,197,94,.10);
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid rgba(34,197,94,.22);
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,.2);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }

    .frame {
      border-radius: 12px;
      overflow: hidden;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .skeleton {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

    iframe {
      display: block;
      width: 100%;
      border: 0;
      background: transparent;
      transition: opacity .3s ease;
    }
    iframe.loading { opacity: 0; }
    iframe.loaded  { opacity: 1; }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 2px;
      font-size: 11px;
      color: #64748b;
    }
    .foot a { color: #3b82f6; text-decoration: none; font-weight: 600; }
    .foot a:hover { text-decoration: underline; }

    @media (max-width: 560px) {
      .w      { padding: 10px; border-radius: 12px; }
      .sub, .foot .hint { display: none; }
      iframe  { min-height: 420px; }
    }

    @media (prefers-color-scheme: dark) {
      :host-context([data-theme="auto"]) .w {
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        border-color: #334155;
        color: #f1f5f9;
      }
      :host-context([data-theme="auto"]) .brand { color: #f1f5f9; }
      :host-context([data-theme="auto"]) .frame  { background: #1e293b; border-color: #334155; }
      :host-context([data-theme="auto"]) .skeleton { background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%); background-size: 200% 100%; }
    }
  `;

  class EffectimeEmbed extends HTMLElement {
    static get observedAttributes() {
      return ['token', 'views', 'height', 'lang', 'label', 'office', 'member', 'mode'];
    }

    connectedCallback() { this._render(); }
    attributeChangedCallback() { if (this.shadowRoot) this._render(); }

    _buildSrc() {
      const token  = this.getAttribute('token') || '';
      const views  = this.getAttribute('views') || '';
      const lang   = this.getAttribute('lang')  || 'hu';
      const office = this.getAttribute('office') || '';
      const member = this.getAttribute('member') || '';
      const mode   = this.getAttribute('mode')   || '';
      // Always use /embed/multi — handles single and multi-view alike, with full UI parity.
      const params = new URLSearchParams({ token, views, lang });
      if (office) params.set('office', office);
      if (member) params.set('member', member);
      if (mode && mode !== 'weekly') params.set('mode', mode);
      return `${BASE_URL}/#/embed/multi?${params}`;
    }

    _render() {
      const height = parseInt(this.getAttribute('height'), 10) || 500;
      const label  = this.getAttribute('label') || 'kapacitás &amp; beosztás';
      const src    = this._buildSrc();

      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const root = this.shadowRoot;

      root.innerHTML = `
        <style>${CSS}</style>
        <div class="w">
          <div class="stripe"></div>
          <div class="head">
            <span class="logo" aria-hidden="true">E</span>
            <span class="brand">Effectime</span>
            <span class="sub">· ${label}</span>
            <span class="live" aria-label="Élő adatok"><span class="dot"></span>Live</span>
          </div>
          <div class="frame">
            <div class="skeleton" aria-hidden="true"></div>
            <iframe
              src="${src}"
              style="height:${height}px"
              class="loading"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
              title="Effectime – munkaerő tervező">
            </iframe>
          </div>
          <div class="foot">
            <span class="hint">Real-time workforce data</span>
            <span>Powered by <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer">Effectime</a></span>
          </div>
        </div>`;

      // Skeleton eltüntetése + opacity animáció betöltés után
      const iframe   = root.querySelector('iframe');
      const skeleton = root.querySelector('.skeleton');
      iframe.addEventListener('load', () => {
        skeleton.style.display = 'none';
        iframe.classList.replace('loading', 'loaded');
      }, { once: true });

      // postMessage-alapú dinamikus magasságállítás
      // (ha az app küld { type:'effectime:resize', height:N } üzenetet)
      window.addEventListener('message', (e) => {
        if (e.origin !== BASE_URL) return;
        if (e.data?.type === 'effectime:resize' && e.data.height) {
          iframe.style.height = Math.max(300, e.data.height) + 'px';
        }
      });
    }
  }

  if (!customElements.get('effectime-embed')) {
    customElements.define('effectime-embed', EffectimeEmbed);
  }
})();
