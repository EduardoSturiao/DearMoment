# Wizard `criar/` — Gotchas conhecidos

Lugar pra anotar armadilhas que já mordemos, pra não cair de novo. Quando consertar um bug não-óbvio aqui dentro, **adiciona uma seção**.

---

## 1. Slider de trecho de música — pan no mobile

**Sintoma:** no mobile, dá pra redimensionar o trecho (handles de início/fim funcionam) mas é impossível arrastar o conjunto inteiro pra frente ou pra trás.

**Causa:** os dois handles (`.music-moment-handle--start` e `--end`, 28px cada) ficam posicionados em `left/right: -6px` dentro de `#musicMomentSelection`. Quando o trecho é pequeno (ex.: 30s clip dentro de uma música de 3min ≈ 16% do track ≈ 45px), os dois handles juntos cobrem 100% da largura da seleção. Não sobra área pra um tap de pan.

**Fix atual** (`script.js`, listener de `pointerdown` em `#musicMomentTrack`): roteamento **por posição** (`clientX` vs. `selLeftPx`/`selRightPx`), num único listener no pai do shell. **Não** existem mais listeners de `pointerdown` nos handles individuais nem na seleção.

**Não fazer:**
- Voltar a bindar `pointerdown` em `.music-moment-handle` ou `#musicMomentSelection`. Vai quebrar de novo do mesmo jeito.
- Confiar em `e.target` pra decidir resize vs. pan. Use a posição do toque.

**Como testar antes de commitar mudanças nesse setup:** abre no DevTools mobile (ex.: iPhone 12), seta um trecho de 30s numa música de ~3min, e tenta arrastar o conjunto. Se não arrastar, regrediu.

---

## 2. Cookie banner global vs. wizard fullscreen

**Sintoma:** botões de Avançar/Voltar/Ver preview e o slider de música ficavam mortos no mobile.

**Causa:** `assets/css/cookies.css` define `#sm-cookie-banner` como `position: fixed; bottom: 16px; z-index: 9999`. No mobile vira `flex-direction: column` e ocupa ~210px no rodapé. A wizard usa `100dvh` com layout grid sem nenhum espaço reservado pro banner — o banner cobria a `nav-footer` inteira e parte do slider.

**Fix:** o cookie banner foi removido de `criar/index.html` (HTML, link CSS e script). Ele continua nas landing pages onde o consentimento faz mais sentido (`index.html`, `presente.html`, `cadastro.html`, etc.).

**Não fazer:**
- Re-incluir `cookies.css`/`cookies.js` na wizard sem antes garantir que o layout reserva espaço pro banner OU sem usar uma versão que não seja `position: fixed` no rodapé.
- Adicionar qualquer outro elemento `position: fixed; bottom: 0` na wizard sem pensar em colisão com a `nav-footer`.

---

## 3. Layout mobile da wizard — grid 1fr/auto

A `app-wrapper` na wizard usa `display: grid; grid-template-rows: 1fr auto; height: 100dvh; overflow: hidden` no mobile (≤900px). A linha 1 é `.steps-panel` (com flex column interno: progress-header, steps-container scrollável, nav-footer); a linha 2 é `.preview-panel` em `column-reverse` (preview-header sempre visível na base, preview-body expande pra cima quando aberto).

**Não fazer:**
- Remover `min-height: 0` de `.steps-panel` no mobile — sem isso o grid não consegue encolher abaixo do conteúdo natural e o `overflow: hidden` da `steps-container` para de funcionar.
- Trocar pra `position: fixed` na `.preview-panel` mobile sem revisar todo o stacking — versões anteriores faziam isso e brigavam com a nav-footer.
