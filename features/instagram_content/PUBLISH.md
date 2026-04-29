# Vibe Web Instagram — Publish Runbook (v1)

Tudo que você precisa pra subir o feed inicial. Ordem importa.

---

## TL;DR

```bash
python scripts/build.py --instagram
```

Vai produzir 27 PNGs em `features/instagram_content/renders/`. Você publica esses PNGs manualmente no Instagram via Meta Business Suite. **Não há automação de upload nesta versão** — Spec E (futuro) cobre Meta Marketing API.

---

## 1. Conferência prévia (uma vez, antes do primeiro push)

### Handle da conta

A bio + watermark dos posts usam `@vibeweb.eu` por padrão. Se o handle real for outro, **uma única linha em `brand/tokens.css` resolve**:

```css
:root {
  /* ... */
  --ig-handle: "@SEU_HANDLE_AQUI";   /* ← muda aqui */
}
```

Depois rode `python scripts/build.py --instagram` de novo, copie os renders pra goldens, commit. (Procedimento detalhado em §5.)

### Link da bio

A bio aponta pra `https://vibeweb.eu/start`. Se ainda não tiver landing, use Linktree provisório ou aponta pra um Calendly/Notion. Atualize quando o site estiver pronto.

### Assets dependentes

Os 5 slides do carousel-portfolio usam screenshots em `ads/assets/`:
- `site-onearc.png` · `site-alytics.png` · `site-lunera.png` · `site-messageai.png` · `site-dreelio.png`

Esses arquivos já existem. Se algum for removido/renomeado, o `build_jobs()` agora **falha alto** com `FileNotFoundError` listando o que sumiu (não mais render silencioso de página de erro).

---

## 2. Gerar todos os assets

```bash
python scripts/build.py --instagram
```

Produz **27 PNGs** em `features/instagram_content/renders/` (~45-60 segundos):

```
single-manifesto.png                      ← grid slot 1
single-cost-of-inaction.png               ← grid slot 2
single-niche-tag.png                      ← grid slot 3
carousel-process-slide-1.png .. -7.png    ← grid slot 4 (carousel de 7 slides)
single-proof-number.png                   ← grid slot 5
carousel-services-slide-1.png .. -7.png   ← grid slot 6 (carousel de 7 slides)
single-offer-mechanics.png                ← grid slot 7
carousel-portfolio-slide-1.png .. -7.png  ← grid slot 8 (carousel de 7 slides)
single-cta-pure.png                       ← grid slot 9
```

Se aparecer `[FAIL]` em qualquer linha do output, **a função levanta `RuntimeError`** com a lista. Não publica nada incompleto.

Para gerar tudo (brand + ads + IG):
```bash
python scripts/build.py --all
```

---

## 3. Layout do grid (3×3, ordem newest-top-left)

Quando você abre `instagram.com/vibeweb.eu`, o grid lê assim:

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

Instagram preenche grid **do post mais recente** (top-left) **pro mais antigo** (bottom-right). Por isso você precisa **publicar na ordem inversa**: post 9 → post 8 → ... → post 1.

---

## 4. Publicação manual (Meta Business Suite)

### Sequência exata

Abra Meta Business Suite Composer (business.facebook.com/composer). Pra cada slot do grid, na ordem 9 → 1:

#### Posts 1 (manifesto), 2 (cost-of-inaction), 3 (niche-tag), 5 (proof-number), 7 (offer-mechanics), 9 (cta-pure) — **single image**
1. Selecionar Instagram como destino.
2. Upload do PNG correspondente em `features/instagram_content/renders/single-NAME.png`.
3. Caption: livre. Sugestões em **§7. Caption templates** abaixo.
4. Publish (não-agendado pra simplificar v1).

#### Posts 4 (carousel-process), 6 (carousel-services), 8 (carousel-portfolio) — **carousel de 7 slides**
1. Selecionar Instagram + carousel.
2. Upload **na ordem** dos 7 slides:
   `carousel-X-slide-1.png` → `slide-2.png` → ... → `slide-7.png`.
3. Caption sugerida em **§7**.
4. Publish.

### Ordem cronológica recomendada

Pra grid landing newest-top-left correto, **publique nesta ordem** (intervalo de ~1-2 minutos pra preservar timestamps):

| Sequência | Post | Tipo |
|---:|---|---|
| 1º (mais antigo) | `single-cta-pure.png` | single |
| 2º | `carousel-portfolio-slide-{1..7}.png` | carousel |
| 3º | `single-offer-mechanics.png` | single |
| 4º | `carousel-services-slide-{1..7}.png` | carousel |
| 5º | `single-proof-number.png` | single |
| 6º | `carousel-process-slide-{1..7}.png` | carousel |
| 7º | `single-niche-tag.png` | single |
| 8º | `single-cost-of-inaction.png` | single |
| 9º (mais recente) | `single-manifesto.png` | single |

---

## 5. Bio

Texto pronto em `features/instagram_content/bio.md`. Copie e cole no campo Bio do Instagram (Edit Profile → Bio):

```
Custom websites · €450 · 7 days
For European freelancers + small businesses
DM 'site' to start →
@vibeweb.eu  ↓
```

E configure o link da bio (Edit Profile → Website) para `https://vibeweb.eu/start` (ou seu link provisório).

**Caracteres usados:** ~110 / 150 limite IG. Margem de 40 chars pra adicionar emoji ou call-out se quiser.

---

## 6. Highlights

Já temos 5 capas renderizadas em `brand/social/renders/`:
- `instagram-highlight-services.png`
- `instagram-highlight-portfolio.png`
- `instagram-highlight-about.png`
- `instagram-highlight-contact.png`
- `instagram-highlight-feed.png`

**Ordem do pin (esquerda → direita) no perfil:** services → portfolio → about → contact → feed.

Para criar cada highlight:
1. Crie um Story com qualquer foto (será descartado).
2. Save to Highlights → New Highlight.
3. Cover: upload do PNG correspondente do `brand/social/renders/`.
4. Title: `Services` / `Portfolio` / `About` / `Contact` / `Feed`.

Conteúdo dentro de cada highlight é livre — adicione ao longo das semanas (cases, depoimentos, etc.).

---

## 7. Caption templates (sugestões)

Copys curtos, hooks em <0.5s, sempre fechando com DM CTA. Ajuste como quiser.

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

**Post 4 — carousel-process (7 slides):**
> Day 1 to Day 7. Real timeline, no asterisks.
>
> Brief on Monday. Live by next Monday. €450 fixed.
>
> Swipe → and DM "site" if this looks like your week.

**Post 5 — proof-number:**
> 5 sites. 60 days. €450 each. Every client said yes round 1.
>
> Yours next? DM "site" →

**Post 6 — carousel-services (7 slides):**
> What's actually in the €450 package — and what *isn't*.
>
> No templates. No stock. No 6-week timelines.
>
> Swipe to see → DM "site" to start.

**Post 7 — offer-mechanics:**
> €450. 7 days. 5 pages. Custom design. Real code. Live in a week.
>
> Read that twice. DM "site" for the brief →

**Post 8 — carousel-portfolio (7 slides):**
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

## 8. Cadência sugerida (pós-launch)

Não automatizado nesta v1 — você decide. Recomendação:

| Formato | Frequência | Esforço |
|---|---|---|
| Static post (singles) | 2× / semana (Ter/Sex) | Baixo — reutiliza templates existentes |
| Carousel | 1× / semana (Qua) | Médio |
| Story | 3-5× / semana | Alto sem template (futuro spec adiciona) |
| Reel | 1× / semana | **Spec D futuro** — Playwright não renderiza vídeo |

---

## 9. KPIs a monitorar

Como o IG é landing dos ads Meta, métricas que importam são **funil**, não engagement:

| KPI | Target mês 1 | Onde ver |
|---|---|---|
| Profile visit → DM rate | ≥ 4% | Insights → Profile actions |
| Profile visit → bio link click | ≥ 6% | Bio link tracking (UTM) |
| Carousel completion rate | ≥ 60% (algoritmo 2026 ranqueia por dwell time) | Insights por post |
| Save rate (carrosséis) | ≥ 2% | Insights |
| DM → discovery call | ≥ 25% | CRM/Notion manual |

**Não-KPIs:** likes absolutos, follower count. IG 2026 não ranqueia por isso.

---

## 10. Re-render quando precisar

Sempre que você mudar copy, handle, ou design:

```bash
python scripts/build.py --instagram
```

Se a saída visual mudar de propósito (ex: trocou `--ig-handle`), atualize os goldens:

```bash
cp features/instagram_content/renders/*.png features/instagram_content/goldens/
git add features/instagram_content/goldens/
git commit -m "chore(instagram): refresh goldens after <reason>"
```

Se o golden mismatch for **inesperado**, pare e investigue: provavelmente fonte não carregou, ou um asset quebrou. O test `test_visual_regression` te diz qual PNG drift'ou.

---

## 11. Verify gate (rodar antes de qualquer commit no IG factory)

```bash
pytest -q
```

Espera-se: **283 passed**. Cobre:
- Tokens-truth (nenhum hex literal nas templates ou CSS irmãos)
- Safe-zone estática (CSS lint nos critical selectors)
- Safe-zone runtime (Pillow band scan dos top/bottom 60px)
- Visual regression (Pillow ImageChops vs goldens)
- Job contract (27 jobs, 1080×1350, carousels com `?slide=`)
- Build CLI (`--instagram` flag)

Se algo falhar, o teste te aponta arquivo/linha. O pipeline não tem fallbacks silenciosos — erro = traceback claro.

---

## 12. Estrutura de arquivos (referência rápida)

```
features/instagram_content/
├── PUBLISH.md            ← este arquivo
├── CLAUDE.md             ← contexto técnico pra agentes
├── bio.md                ← texto da bio (cole no IG)
├── render.py             ← entry-point assíncrono
├── jobs.py               ← lista declarativa dos 27 RenderJobs
├── test_render.py        ← 4 layers: dimensions/safe-zone-static/runtime/visual-regression
├── test_jobs.py          ← contract tests
├── templates/            ← 9 templates HTML (+ 3 .css siblings dos carousels)
│   ├── single-{manifesto,cost-of-inaction,niche-tag,proof-number,offer-mechanics,cta-pure}.html
│   ├── carousel-portfolio.html  +  carousel-portfolio.css
│   ├── carousel-services.html   +  carousel-services.css
│   └── carousel-process.html    +  carousel-process.css
├── renders/              ← gitignored, regenerável
└── goldens/              ← 27 PNGs commitados (regression baseline)

brand/tokens.css          ← design tokens (cores, fontes, --ig-handle)
scripts/build.py          ← CLI: --brand | --ads | --instagram | --all
shared/visual_regression.py  ← thresholds compartilhados (PIXEL_DIFF_THRESHOLD, ALLOWED_DIFF_FRACTION)
```

---

## 13. Roadmap (out of scope nesta v1)

| Spec | Quando fizer sentido |
|---|---|
| **Spec D — Reels** | Quando o feed estiver vivo + tiver tempo pra ferramenta de vídeo (Remotion/FFmpeg) |
| **Spec E — Conversion funnel** | Landing `vibeweb.eu/start` + DM auto-reply + Calendly/CRM |
| **Spec 1 — AI Creative Factory** | LLM gera copy variants das templates por metodologia (PAS/NPQEL/etc) |
| **Spec — Story templates** | Hoje só temos os 5 highlight covers; faltam stories de update/teaser |
| **Spec — Meta Marketing API** | Automação de upload e tracking direto da CLI |

Esses estão documentados em `docs/superpowers/specs/2026-04-29-instagram-content-factory-design.md` §13.

---

**Pronto pra publicar.** Comece pelo §1, depois §2, depois §4. Bio + highlights podem ir junto ou depois (nova ordem não afeta o grid). Boa sorte. 🚀
