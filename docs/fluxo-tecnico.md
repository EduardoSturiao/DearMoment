

# SoulMates — Documentação Técnica do Fluxo

> **Propósito:** Registrar a arquitetura de navegação, lógica de estado e mecanismos do produto para referência futura. Atualizar sempre que uma nova etapa for implementada.

---

## 1. Visão Geral do Produto

**SoulMates** é uma plataforma SaaS de presentes digitais personalizados. O usuário cria uma homenagem (fotos, música, mensagem, contador de tempo), paga, e recebe um **link + QR Code** que ao ser escaneado abre a página pública do presente — projetada para emocionar quem recebe.

**Stack:** HTML + CSS + JS vanilla. Sem build tools, sem frameworks. Dependências via CDN (Bootstrap 5, Google Fonts, Font Awesome, qrcodejs).

---

## 2. Fluxo Completo do Usuário

```
[Landing Page — index.html]
        |
        | clica em "Criar Homenagem Agora"
        ↓
[Wizard de criação — criar/index.html]
        |
        | preenche 8 etapas (tipo, nomes, data, título,
        | música, fotos, mensagem, foto de capa)
        |
        | no step-final clica em "Finalizar com esse plano"
        ↓
[Verificação de sessão — criar/script.js]
        |
        |—— logado? ——Sim——→ [Pagamento — pagamento.html]
        |
        └——— Não ——→ [Login — login.html]
                            |
                            | após login bem-sucedido
                            ↓
                    [Pagamento — pagamento.html]
                            |
                            | preenche dados do cartão e paga
                            ↓
                    [Sucesso + QR Code gerado]
                            |
                            | escaneia o QR Code / abre o link
                            ↓
                    [Página do Presente — presente.html?id=XXXX]
```

---

## 3. Arquivos e Responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Landing page. CTAs apontam para `criar/index.html` diretamente (sem passar pelo login) |
| `criar/index.html` | Wizard multi-step. 8 etapas + step-final com planos |
| `criar/script.js` | Estado global do wizard, localStorage, preview reativo, navegação entre steps, `saveGift()`, `setupPlanButtons()` |
| `criar/style.css` | Estilos do wizard e do preview |
| `login.html` | Formulário de login |
| `assets/js/login.js` | Validação do form + sessão simulada + redirect pós-login |
| `pagamento.html` | Resumo do pedido + formulário de cartão + tela de sucesso + geração do QR Code |
| `assets/css/pagamento.css` | Estilos da página de pagamento |
| `presente.html` | *(a implementar)* Página pública do presente — destino do QR Code |
| `assets/css/presente.css` | *(a implementar)* Estilos da página do presente |

---

## 4. Estado no localStorage — Todas as Chaves

O sistema não possui backend. Todo o estado é persistido no `localStorage` do navegador.

| Chave | Tipo | Quando é criada | Quando é removida | Conteúdo |
|---|---|---|---|---|
| `soulmates_wizard_state` | JSON (objeto) | A cada input do wizard | Após `saveGift()` ao completar o step 8 | Todo o estado do wizard: nomes, data, cidade, título, youtubeId, fotos (base64), mensagem, foto de capa, etc. |
| `soulmates_gifts` | JSON (array) | Ao concluir o wizard | Nunca (histórico) | Array de presentes salvos. Cada item tem os mesmos campos do wizard + `createdAt` + `id` *(a adicionar)* |
| `soulmates_pending_plan` | string | Ao clicar num plano no step-final | Após pagamento concluído | `'vitalicio'` ou `'24h'` |
| `soulmates_pending_wrapped` | string `'1'` | Ao adicionar Wrapped no step-final | Após pagamento concluído | Indica se o usuário adicionou a versão Wrapped (+R$7,90) |
| `soulmates_session` | JSON (objeto) | Após login bem-sucedido | *(não removida — sessão permanente por ora)* | `{ loggedIn: true, email: string }` |

> **Atenção:** `soulmates_wizard_state` contém fotos em base64, que podem ser grandes. O limite típico do localStorage é ~5MB. Avisar o usuário ao atingir o limite é responsabilidade do `try/catch` já presente em `saveState()`.

---

## 5. Mecanismo de Autenticação (Simulado)

Não há backend de autenticação. A sessão é simulada:

1. **Login:** `login.js` valida se os campos não estão vazios. Qualquer e-mail/senha não-vazia é aceita.
2. **Sessão:** `localStorage.setItem('soulmates_session', JSON.stringify({ loggedIn: true, email }))`.
3. **Verificação:** `criar/script.js` faz `localStorage.getItem('soulmates_session')` — se existir, considera logado.

**Quando integrar um backend real**, substituir essa lógica por:
- JWT token no localStorage ou cookie HttpOnly
- Verificação do token a cada ação sensível
- Endpoint de login real

---

## 6. Mecanismo do QR Code *(a implementar)*

### 6.1 Visão geral

Ao concluir o pagamento, o sistema deve:
1. Gerar um **ID único** para o presente (ex: `uuid` simples via `Date.now() + Math.random()`)
2. Salvar esse ID junto ao presente em `soulmates_gifts`
3. Gerar um QR Code apontando para `./presente.html?id=XXXX`
4. Exibir o QR Code na tela de sucesso
5. Oferecer botão de **download** do QR Code como imagem PNG

### 6.2 Biblioteca utilizada

**qrcodejs** — carregada via CDN, sem npm:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

Uso básico:
```js
new QRCode(document.getElementById('qrcodeContainer'), {
  text: 'https://seudominio.com/presente.html?id=XXXX',
  width: 200,
  height: 200,
  colorDark: '#121820',
  colorLight: '#ffffff',
});
```

### 6.3 Download do QR Code

O `qrcodejs` renderiza o QR em um `<canvas>`. Para baixar:
```js
const canvas = document.querySelector('#qrcodeContainer canvas');
const link = document.createElement('a');
link.download = 'qrcode-soulmates.png';
link.href = canvas.toDataURL('image/png');
link.click();
```

### 6.4 Fluxo de dados até o QR Code

```
saveGift() em criar/script.js
    → adiciona id: crypto.randomUUID() ao objeto do presente
    → salva em soulmates_gifts[]

pagamento.html (sucesso)
    → lê o último gift de soulmates_gifts
    → constrói a URL: window.location.origin + '/presente.html?id=' + gift.id
    → instancia QRCode apontando para essa URL
    → remove soulmates_pending_plan e soulmates_pending_wrapped
```

---

## 7. Página Pública do Presente — `presente.html` *(a implementar)*

### 7.1 Responsabilidade

É a página que a pessoa presenteada vê ao escanear o QR Code. É o **produto final** — deve ser visualmente impactante.

### 7.2 Como lê os dados

```js
const params = new URLSearchParams(window.location.search);
const id     = params.get('id');
const gifts  = JSON.parse(localStorage.getItem('soulmates_gifts') || '[]');
const gift   = gifts.find(g => g.id === id);
```

> **Limitação atual:** Como os dados estão no `localStorage`, a página do presente só funciona no mesmo navegador/dispositivo em que o presente foi criado. Para funcionar de verdade via QR Code em outro celular, é necessário um backend que persista os dados do presente em um banco de dados e os sirva pela URL.

### 7.3 Seções da página

| Seção | Conteúdo |
|---|---|
| Player de música | YouTube embed com a música do casal. Auto-play ao abrir. |
| Foto de capa | Imagem de destaque (extraPhoto ou primeira da galeria). Ocupa a parte superior. |
| Nomes + título | `name1 & name2` com o título personalizado |
| Contador em tempo real | Anos, meses, dias, horas, minutos, segundos desde `startDate`. Atualiza a cada segundo via `setInterval`. |
| Mensagem | Texto da mensagem do casal, estilizado |
| Galeria de fotos | Grid com as fotos enviadas (até 6). Com lightbox ao clicar. |
| Cidade | Localização onde se conheceram |

### 7.4 Comportamento especial

- Fundo escuro animado (partículas de coração, já existentes em `styles.css`)
- Música começa a tocar automaticamente ao abrir (depende de política do browser — autoplay com interação do usuário)
- Meta tags Open Graph para que o link fique bonito ao compartilhar no WhatsApp/Instagram

---

## 8. Dependências Externas (CDN)

| Biblioteca | Versão | Uso |
|---|---|---|
| Bootstrap | 5.3.8 | Grid e componentes na landing page |
| Font Awesome | 6.x / 7.x | Ícones |
| Google Fonts | — | Sora + Syne |
| qrcodejs | 1.0.0 | Geração do QR Code *(a usar em pagamento.html)* |
| IBGE API | — | Autocomplete de cidades no wizard (`criar/script.js`) |

---

## 9. Convenções do Projeto

- **CSS:** cada página tem seu próprio arquivo em `assets/css/`. Variáveis globais (cores, fontes) em `assets/css/styles.css`.
- **JS:** sem módulos ES6 (`import/export`). Scripts carregados com `<script src>` no final do `<body>`.
- **Validadores de formulário** retornam `{ valid: boolean, message: string }` (padrão do `main.js`).
- **Transições de página:** classe `fade-out` no `body` + `setTimeout` de 400ms antes do redirect.
- **Cores principais:** `#ff6dba` (rosa primário), `#121820` (fundo escuro), `#161b24` (card), `#8892a4` (texto secundário).
- **Fontes:** `Syne` para títulos e destaques, `Sora` para corpo de texto.
