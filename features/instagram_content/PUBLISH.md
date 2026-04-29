# Vibe Web Instagram — Complete Launch Runbook (v1)

Tudo que você precisa pra abrir a conta do zero. **48 PNGs** prontos pra upload.

---

## TL;DR — 3 comandos

```bash
python scripts/build.py --instagram   # gera 48 PNGs
pytest -q                             # confirma tudo verde (367 passed)
ls features/instagram_content/renders/
```

Daí segue o runbook abaixo na ordem: §1 (account setup) → §2 (avatar) → §3 (bio) → §4 (highlights + starter stories) → §5 (grid posts) → §6 (caption templates).

---

## Inventário — o que você ganhou

```
features/instagram_content/renders/   ← 48 PNGs gerados
│
├── account-avatar.png                 (1080×1080) — foto de perfil
│
├── highlight-cover-services.png       (1080×1920) ┐
├── highlight-cover-portfolio.png      (1080×1920) │ 5 capas de
├── highlight-cover-about.png          (1080×1920) │ destaque
├── highlight-cover-contact.png        (1080×1920) │
├── highlight-cover-feed.png           (1080×1920) ┘
│
├── story-starter-services-{1,2,3}.png (1080×1920) ┐
├── story-starter-portfolio-{1,2,3}.png            │ 15 stories pra
├── story-starter-about-{1,2,3}.png                │ encher os 5
├── story-starter-contact-{1,2,3}.png              │ destaques
├── story-starter-feed-{1,2,3}.png     (1080×1920) ┘
│
├── single-{6 posts}.png               (1080×1350) ┐
├── carousel-portfolio-slide-{1..7}.png (1080×1350)│ 27 grid
├── carousel-services-slide-{1..7}.png  (1080×1350)│ posts
└── carousel-process-slide-{1..7}.png   (1080×1350)┘
```

---

## §1. Account setup (faça antes de qualquer upload)

### 1.1 Criar a conta

1. App Instagram → Sign up → use email business (não pessoal).
2. Username: `@vibeweb.eu` *(ou o handle que você confirmar — se mudar, troque uma linha em `brand/tokens.css` `--ig-handle`, regenere os assets)*.
3. Trocar pra **Professional account** (Settings → Account → Switch to Professional).
4. Categoria: **"Web Designer"** ou **"Marketing Agency"** (escolha a que mais aproxima).

### 1.2 Contact options (Edit Profile → Contact info)

| Campo | Valor sugerido |
|---|---|
| **Public business email** | seu email de trabalho (importante: é como leads te encontram fora do DM) |
| **Phone** | opcional — só se você quer atender por WhatsApp Business |
| **Address** | deixa em branco (mono-tenant remoto, não há escritório público) |

### 1.3 Action buttons (Edit Profile → Action buttons)

| Botão | Configuração |
|---|---|
| **Email** | botão primário — direciona pro public email |
| **Book** ou **Reserve** | linka pra `vibeweb.eu/start` ou Calendly se já tiver. (Se ainda não, pula esse passo até a landing existir.) |

Skip "Order Food", "Get Tickets", "Get Quote" — não fazem sentido pra serviço B2B custom.

### 1.4 Privacy

- **Account: Public** (você quer ser encontrado).
- **Allow tagging: Everyone** (cases podem te taggar).
- **Disable Messages from non-followers? NO** — você QUER DM de stranger leads. Mantenha aberto.

---

## §2. Profile photo (avatar)

**Arquivo:** `features/instagram_content/renders/account-avatar.png` (1080×1080)

Edit Profile → Change Photo → upload o arquivo. Instagram vai cortar em círculo automaticamente — o design já está safe pra esse crop (V mark centralizado com margem de ~12%, glow verde sutil, ring decorativo apenas na borda externa).

---

## §3. Bio

**Arquivo:** `features/instagram_content/bio.md`

Cole no Edit Profile → Bio:

```
Custom websites · €450 · 7 days
For European freelancers + small businesses
DM 'site' to start →
@vibeweb.eu  ↓
```

**Link in bio:** `https://vibeweb.eu/start` (se ainda não existir, use Linktree provisório ou direto Calendly).

**Char count:** ~110 / 150 IG limit. Você tem 40 chars de margem se quiser adicionar emoji ou call-out.

---

## §4. Highlights (covers + starter content)

5 destaques com 3 stories cada — pra que a conta NÃO esteja vazia quando alguém clicar num highlight.

### 4.1 Para cada destaque, repita o processo:

**Pra criar um destaque novo no Instagram:**
1. Profile → seu avatar (que vai ter um "+" depois) → New Story.
2. Upload temporário: qualquer foto (vai ser descartada).
3. Tap "Highlight" no story → New highlight.
4. **Cover:** Edit cover → upload a `highlight-cover-{nome}.png`.
5. **Title:** Services / Portfolio / About / Contact / Feed (capitalizado).
6. Save.

**Pra encher cada destaque com as 3 stories starter:**
1. Profile → tap o destaque → Edit Highlight (ou "..." → Edit).
2. Add stories → upload os 3 PNGs do destaque na ordem `-1` → `-2` → `-3`.
3. Remova a story temporária da etapa 4.1.

### 4.2 Mapeamento exato (cover + 3 stories)

| Highlight | Cover | Stories (na ordem) |
|---|---|---|
| **Services** | `highlight-cover-services.png` | `story-starter-services-1.png` (overview) → `services-2.png` (what's included, lista de checks) → `services-3.png` (CTA "DM 'site'") |
| **Portfolio** | `highlight-cover-portfolio.png` | `portfolio-1.png` (5 sites · 60 days) → `portfolio-2.png` (niches list) → `portfolio-3.png` (yours next?) |
| **About** | `highlight-cover-about.png` | `about-1.png` (hi I'm Vibe Web) → `about-2.png` (philosophy) → `about-3.png` (7-day method) |
| **Contact** | `highlight-cover-contact.png` | `contact-1.png` (DM 'site') → `contact-2.png` (book a call) → `contact-3.png` (24h response) |
| **Feed** | `highlight-cover-feed.png` | `feed-1.png` (saved highlights intro) → `feed-2.png` (save tip) → `feed-3.png` (explore grid) |

### 4.3 Ordem de pin (esquerda → direita)

Profile → tap and hold em cada highlight → drag pra reordenar:

```
services → portfolio → about → contact → feed
```

**Por quê:** funil mental do visitante — primeiro vê **o que você faz**, depois **prova** (portfólio), depois **quem você é** (about), depois **como contatar** (contact), e por último **conteúdo do feed** (auto-referencial).

---

## §5. Grid posts (9 slots, publicar em ordem reversa)

### 5.1 Layout do grid (3×3, ordem newest-top-left)

Ao abrir `instagram.com/vibeweb.eu`, o grid renderiza assim:

```
┌──────────────────┬──────────────────┬──────────────────┐
│ 1. manifesto     │ 2. cost-of-      │ 3. niche-tag     │
│ "Most freelancers│    inaction      │ "Designers who   │
│  send a Notion   │ "Every week      │  can't afford a  │
│  link..."        │  without a site" │  generic agency" │
├──────────────────┼──────────────────┼──────────────────┤
│ 4. CAROUSEL      │ 5. proof-number  │ 6. CAROUSEL      │
│    process       │ "5 sites. 7 days │    services      │
│ "How I deliver   │  each. €450      │ "What you get    │
│  in 7 days"      │  minimum."       │  for €450"       │
├──────────────────┼──────────────────┼──────────────────┤
│ 7. offer-        │ 8. CAROUSEL      │ 9. cta-pure      │
│    mechanics     │    portfolio     │ "Send 'site'.    │
│ "€450. 7 days.   │ "5 sites I built │  Get a Loom in   │
│  Done."          │  in 60 days"     │  24h."           │
└──────────────────┴──────────────────┴──────────────────┘
```

### 5.2 Sequência de upload (do mais antigo pro mais recente)

Pra grid newest-top-left landar correto, **publique na ordem inversa** (intervalo de 1-2 minutos pra preservar timestamps):

| Sequência | Post | Tipo |
|---:|---|---|
| 1º | `single-cta-pure.png` | single |
| 2º | `carousel-portfolio-slide-{1..7}.png` | carousel (7 slides) |
| 3º | `single-offer-mechanics.png` | single |
| 4º | `carousel-services-slide-{1..7}.png` | carousel (7 slides) |
| 5º | `single-proof-number.png` | single |
| 6º | `carousel-process-slide-{1..7}.png` | carousel (7 slides) |
| 7º | `single-niche-tag.png` | single |
| 8º | `single-cost-of-inaction.png` | single |
| 9º | `single-manifesto.png` | single |

### 5.3 Como publicar cada tipo

**Single:** Composer → Instagram → Image → upload PNG → caption (§6) → Publish.

**Carousel:** Composer → Instagram → Carousel → upload os 7 slides na ordem `-slide-1.png` ... `-slide-7.png` → caption → Publish.

---

## §6. Caption templates (sugestões PAS-aligned)

Hooks <0.5s, sempre fechando com DM CTA. Ajuste conforme sua voz.

**Post 1 — manifesto:**
> Most freelancers in Europe still pitch with a Notion link.
>
> If your work deserves better, your site should match.
>
> Custom site, €450, 7 days. DM "site" to start. ↓

**Post 2 — cost-of-inaction:**
> Every week without a site, ~3 prospects pick someone else.
>
> Most don't tell you why. They just disappear.
>
> Stop the bleed. €450 / 7 days. DM "site". ↓

**Post 3 — niche-tag (designers):**
> If you're a designer, your site IS the portfolio. Generic agency template = generic portfolio.
>
> I build custom sites that look like your work — not their grid.
>
> €450. 7 days. DM "site". ↓

**Post 4 — carousel-process:**
> Day 1 to Day 7. Real timeline, no asterisks.
>
> Brief on Monday. Live by next Monday. €450 fixed.
>
> Swipe → and DM "site" if this looks like your week.

**Post 5 — proof-number:**
> 5 sites. 60 days. €450 each. Every client said yes round 1.
>
> Yours next? DM "site" →

**Post 6 — carousel-services:**
> What's actually in the €450 package — and what *isn't*.
>
> No templates. No stock. No 6-week timelines.
>
> Swipe to see → DM "site" to start.

**Post 7 — offer-mechanics:**
> €450. 7 days. 5 pages. Custom design. Real code. Live in a week.
>
> Read that twice. DM "site" for the brief →

**Post 8 — carousel-portfolio:**
> 5 European freelancers · 5 custom sites · 60 days.
>
> Swipe → pick a favorite → DM "site" if you want yours next.

**Post 9 — cta-pure:**
> Send "site" to my DMs.
>
> I'll record a 5-minute Loom showing exactly how I'd build yours. Free. No deck.
>
> Direct line: ↓

---

## §7. Pinned posts (3 slots no topo do grid)

Após publicar tudo, IG permite pin de 3 posts (Profile → 3-dot menu de cada post → Pin to your profile). Recomendado:

1. **Post 8 — carousel-portfolio** (prova social mais forte)
2. **Post 6 — carousel-services** (offer breakdown — converte)
3. **Post 9 — cta-pure** (atalho direto pro DM)

---

## §8. Cadência sugerida (pós-launch)

Não automatizado v1 — você decide. Recomendação:

| Formato | Frequência | Esforço |
|---|---|---|
| Static post (singles) | 2× / semana (Ter/Sex) | Baixo — reutiliza templates |
| Carousel | 1× / semana (Qua) | Médio |
| Story | 3-5× / semana | Alto sem template (futuro spec) |
| Reel | 1× / semana | **Spec D futuro** — Playwright não renderiza vídeo |

---

## §9. KPIs a monitorar

IG é **landing dos ads Meta** — métricas são funil, não engagement:

| KPI | Target mês 1 | Onde ver |
|---|---|---|
| Profile visit → DM rate | ≥ 4% | Insights → Profile actions |
| Profile visit → bio link click | ≥ 6% | UTM no link |
| Carousel completion rate | ≥ 60% | Insights por post |
| Save rate (carousels) | ≥ 2% | Insights |
| DM → discovery call | ≥ 25% | CRM/Notion manual |

**Não-KPIs:** likes absolutos, follower count. Algoritmo 2026 não ranqueia por isso.

---

## §10. Re-render quando precisar

Sempre que mudar copy, handle, ou design:

```bash
python scripts/build.py --instagram   # regenera os 48 PNGs (~90s)
```

Se a saída visual mudar de propósito (ex: trocou `--ig-handle`), atualize goldens:

```bash
cp features/instagram_content/renders/*.png features/instagram_content/goldens/
git add features/instagram_content/goldens/
git commit -m "chore(instagram): refresh goldens after <reason>"
```

---

## §11. Verify gate

Antes de qualquer commit relacionado:

```bash
pytest -q
```

Espera-se: **367 passed**. Cobre:

| Camada | O que valida |
|---|---|
| Tokens-truth | nenhum hex literal, todos templates importam tokens.css, todos usam `var(--*)`, sem `rgba(4,211,97,X)` literal |
| Safe-zone estática | CSS lint nos critical selectors (h1, .hook, .cta, .cta-bar, .main-text, .headline) — nada com `top:` ou `bottom:` < 60px (lê HTML + CSS irmãos) |
| Safe-zone runtime | Pillow band scan: top/bottom 60px de cada PNG ≥ 99% background pixels |
| Visual regression | Pillow ImageChops vs goldens (Manhattan diff ≤ 20, ≤1% pixels excedendo) |
| Job contract | 48 jobs, dimensões corretas por categoria, queries `?slide=`/`?type=`/`?slot=` corretas |
| Build CLI | `--instagram` flag listado em `--help` |

Se algo falhar, o teste aponta arquivo:linha. Pipeline sem fallbacks silenciosos — erro = traceback claro.

---

## §12. Estrutura de arquivos (referência)

```
features/instagram_content/
├── PUBLISH.md            ← este arquivo (runbook completo)
├── CLAUDE.md             ← contexto técnico pra agentes
├── bio.md                ← texto da bio (cole no IG)
├── render.py             ← entry-point assíncrono
├── jobs.py               ← lista declarativa dos 48 RenderJobs
├── test_render.py        ← 4 layers: dimensions/safe-zone-static/runtime/visual-regression
├── test_jobs.py          ← contract tests (count, dimensions, queries)
├── templates/
│   ├── account-avatar.html              (1080×1080) profile photo
│   ├── highlight-cover.html             (1080×1920) ?type=services|portfolio|about|contact|feed
│   ├── story-starter.html               (1080×1920) ?slot=services-1|...|feed-3 (15 slots)
│   ├── single-{6 posts}.html            (1080×1350)
│   ├── carousel-portfolio.html + .css   (1080×1350) ?slide=1..7
│   ├── carousel-services.html  + .css   (1080×1350) ?slide=1..7
│   └── carousel-process.html   + .css   (1080×1350) ?slide=1..7
├── renders/              ← gitignored — 48 PNGs regeneráveis
└── goldens/              ← 48 PNGs commitados (regression baseline)

brand/tokens.css          ← --ig-handle, cores, fontes
scripts/build.py          ← CLI: --brand | --ads | --instagram | --all
shared/visual_regression.py  ← thresholds compartilhados
```

---

## §13. Brand voice quick-ref (pra posts futuros)

Quando você (ou um agente futuro) for criar conteúdo novo, mantenha:

**Tom:**
- Direto, sem bullshit.
- 1ª pessoa: "I build", "DM me", "I'll send".
- Confiante mas não arrogante. "5 sites" > "100+ sites" (não invente).
- Concretude sempre: números reais, prazos reais, preços reais.

**Copy framework (PAS):**
1. **Problem** — espelho do pain do cliente.
2. **Agitate** — consequência de não resolver.
3. **Solution** — sua oferta + CTA explícito.

**Visual:**
- Background: `--bg` (#0a0a0a) sempre.
- Headlines: Syne 800, big, `var(--text)` ou `var(--accent)` em palavras-chave.
- Body: DM Sans 400-500, `var(--text-muted)`.
- Accent verde `--accent` (#04d361) em palavras-chave + CTA.
- Vermelho `--signal-red` SOMENTE pra "what you don't get" / open-loop reveal / fallback de erro.
- Safe-zone: 60px top + 60px bottom.

**CTAs aceitos:**
- "DM 'site' to start" — primário, recorrente.
- "Send 'site' to my DMs" — variação.
- "Yours next? →" — quando precedido por proof.
- Evitar: "Click bio link", "Comment below", "Tag a friend" — métricas vanity.

---

## §14. Roadmap (out of scope v1)

| Spec | Quando |
|---|---|
| **Spec D — Reels** | Quando feed estiver vivo + ferramenta de vídeo (Remotion/FFmpeg) |
| **Spec E — Conversion funnel** | Landing `vibeweb.eu/start` + DM auto-reply + CRM |
| **Spec 1 — AI Creative Factory** | LLM gera copy variants das templates por metodologia |
| **Spec — Reusable story templates** | story-update / story-quote / story-question / story-link |
| **Spec — Meta Marketing API** | Automação de upload e tracking direto da CLI |

---

**Tudo pronto.** Sequência de execução: §1 → §2 → §3 → §4 (5×) → §5 (9 posts em ordem reversa) → §6 (captions) → §7 (pin 3) → §9 (monitorar). 🚀
