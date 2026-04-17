# Prompt de continuação — outro PC

Copie o bloco abaixo e cole no Claude Code do outro PC após `git clone`.

---

## Setup físico (antes de colar o prompt)

```bash
git clone https://github.com/viniciuscffreitas/criativos.git
cd criativos
pip install -e ".[dev]"
playwright install chromium
python -m pytest -q                 # deve dar 141 passed
python scripts/build.py --all       # deve gerar 21 PNGs
```

Se tudo passou, abra Claude Code no diretório `criativos/` e cole o prompt abaixo.

---

## Prompt para colar no Claude Code

```
Estou continuando um projeto de outro PC. Li o CLAUDE.md na raiz e o design spec em docs/superpowers/specs/2026-04-17-ai-creative-factory-design.md. Sei que:

1. Este é a "fábrica de criativos" da Vibe Web. Pipeline Playwright atual gera 21 PNGs deterministicamente.
2. A direção é tornar isso AI-driven: LLM gera copy usando metodologias (PAS funciona, NPQEL é placeholder), A/B variation, GUI web pro meu sócio não-dev, Meta API futuro.
3. O design spec (Spec 1) foi aprovado e documentado. Ainda não foi executado.
4. Código segue princípios AI-first do CLAUDE.md: vertical slices em features/, entry-points verbosos, closed-loop verification, confidence signals, traces.

Pendências que EU (usuário) preciso responder antes de você implementar:

a) **NPQEL — qual é a metodologia?** Preciso expandir o acrônimo e descrever o framework (tipo PAS = Problem-Agitate-Solution, com passos claros). Sem isso, `features/copy_generation/methodologies/npqel.py` fica vazio.

b) **Chave Claude API** — vou setar `ANTHROPIC_API_KEY` como env var no PC novo. Você não precisa disso pra arquitetar, mas precisa saber que o dry-run-mode descrito no spec é pra quando a key não está setada.

c) **Modelo Claude default** — confirmar `claude-sonnet-4-6` conforme CLAUDE.md model routing, ou prefiro Opus pra geração criativa?

d) **Variantes por run** — default 3. Confirma ou ajusta?

Próximas tarefas em ordem de execução (cada uma é /spec separada):

**Spec 1 (design pronto, execução pendente):** copy-as-config + LLM agent skeleton.
- Extrair copy hardcoded dos 6 HTML → `config/ads.yaml`
- Renomear templates pra `.html.j2` e usar Jinja2
- Criar `features/copy_generation/` com agent.py (Claude API + dry-run), methodologies/pas.py (live), methodologies/npqel.py (placeholder até eu definir)
- Testes + visual regression passando
- ~2-3h de trabalho

**Spec 2:** A/B variation orquestrado + migração de scripts/+ads/ pra features/creative_rendering/.

**Spec 3:** Web GUI FastAPI + HTMX (upload assets, escolher metodologia, ver variantes, baixar PNGs).

**Spec 4:** Meta Marketing API (read campaigns first, depois write creatives).

Começa perguntando (a), (b), (c), (d). Depois de responder, executa Spec 1 seguindo /spec → superpowers:writing-plans → superpowers:executing-plans. Respeita HARD GATE do brainstorming: nada de implementação antes de aprovação explícita do plan.

Para cada commit: atômico, mensagem descritiva, rodar pytest + visual regression antes de declarar done. Review Gate obrigatório antes de fechar cada Spec.
```

---

## Contexto extra (opcional — se o agente precisar de mais background)

### Estado atual (snapshot)

- **141 testes passando** em 3 camadas: estrutural, tokens-truth, visual regression.
- **23 commits atômicos** no histórico pós-initial-import.
- **Pipeline unificada:** `python scripts/build.py --all` gera 21 PNGs.
- **tokens.css é single source of truth:** todos templates (11 HTML) importam + usam `var(--*)`. Zero hex hardcoded em CSS context.
- **Wheel install funciona:** `pip install .` expõe `vibeweb-build` console script com `--brand` / `--ads` / `--all`.

### Princípios AI-first ativos (detalhe em CLAUDE.md)

- Vertical slices > technical layering → próximas features em `features/<name>/`
- Verbose entry-points, zero magic
- DAMP contextual (duplicate 2x antes de extrair)
- Tools tipados pra produção, bash só pra exploração
- Closed-loop verification com screenshot + golden diff
- Verbose tracebacks, nunca suprimidos
- Confidence signals (✅/⚠️/🔴) + chain-of-thought traces em todo output LLM
- Limpeza é funcional: dead code reduz espaço de busca do agente

### Arquivos-chave pra ler primeiro no PC novo

1. `CLAUDE.md` — princípios e convenções (obrigatório)
2. `docs/superpowers/specs/2026-04-17-ai-creative-factory-design.md` — design aprovado
3. `docs/plans/pipeline-refactor.md` + `pipeline-refactor-followup.md` — histórico do refactor já concluído
4. `README.md` — overview + install
5. `scripts/pipeline.py` — helpers Playwright compartilhados (vai migrar pra features/creative_rendering/ na Spec 2)
6. `ads/copy.md` — playbook PAS atual com o copy que vai virar seed pro agent

### Decisões locked no design spec (não revisitar sem motivo forte)

- Stack GUI: **FastAPI + HTMX + Jinja2** (rejeitado Next.js e Streamlit)
- LLM: Claude API via `anthropic` SDK
- Config: YAML (human-editable)
- Template: Jinja2 (.html.j2)
- Methodology interface: pluggable via Protocol
- Default A/B: 3 headline variants × 1 body × 1 description
- Multi-tenant: deferido indefinidamente
- Google Ads: deferido indefinidamente

### Decisões ainda pendentes (usuário responde no PC novo)

- NPQEL definition
- Confirm modelo Claude
- Confirm default variants
- Se quer cost tracking / budget guards por run
