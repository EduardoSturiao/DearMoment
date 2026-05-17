/**
 * DearMoment — Cookie Consent
 * Gerencia o consentimento do usuário (LGPD).
 * Chave: 'sm_cookie_consent' → 'accepted' | 'rejected'
 *
 * Uso futuro: antes de carregar analytics/pixels, verifique hasConsent().
 * Exemplo:
 *   if (hasConsent()) { // carrega Google Analytics }
 */

(function () {
  const CONSENT_KEY = 'sm_cookie_consent';

  function getConsent() {
    return localStorage.getItem(CONSENT_KEY);
  }

  function setConsent(value) {
    localStorage.setItem(CONSENT_KEY, value);
  }

  function hideBanner() {
    var banner = document.getElementById('sm-cookie-banner');
    if (banner) {
      banner.classList.add('sm-cookie-hide');
      setTimeout(function () { banner.remove(); }, 400);
    }
  }

  function initBanner() {
    if (getConsent()) return; // já respondeu antes

    var banner = document.getElementById('sm-cookie-banner');
    if (!banner) return;

    // Mostra com pequeno delay para não brigar com animação de entrada da página
    setTimeout(function () {
      banner.classList.add('sm-cookie-show');
    }, 800);

    document.getElementById('sm-cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      hideBanner();
    });

    document.getElementById('sm-cookie-reject').addEventListener('click', function () {
      setConsent('rejected');
      hideBanner();
    });
  }

  // Função pública — use antes de carregar scripts de terceiros
  window.hasConsent = function () {
    return getConsent() === 'accepted';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner);
  } else {
    initBanner();
  }
})();
