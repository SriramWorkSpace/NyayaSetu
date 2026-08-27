<div align="center">

# NyayaSetu

**न्यायसेतु** · *a bridge to justice*

An offline-first desktop suite for the Indian judicial domain, backed by five independently trained machine-learning models — and a screen that shows you exactly how well each one actually works.

[![Status](https://img.shields.io/badge/status-in%20development-C9A227?style=flat-square)](plan.md)
[![License](https://img.shields.io/badge/license-MIT-14120F?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org)
[![Offline](https://img.shields.io/badge/runs-100%25%20offline-4A6B57?style=flat-square)](#privacy)
[![No LLM](https://img.shields.io/badge/no%20generative%20AI-in%20measured%20paths-7A4A42?style=flat-square)](#why-no-llm)

</div>

> [!WARNING]
> **NyayaSetu does not provide legal advice.** It is an academic research project exploring machine learning on Indian legal text. Its outputs are statistical predictions with measurable error rates, not legal opinions. Do not rely on it for any real proceeding.

---

## What it does

| Module | Input | Output |
|---|---|---|
| ⚖️ **Bail Prediction** | Structured case facts | Predicted outcome + calibrated probability + SHAP factor attribution |
| 🧭 **Fairness Audit** | The bail model itself | Disparity gaps, before and after controlling for legitimate legal factors |
| 🔍 **Extractive QA** | A question + a judgment | The answer **highlighted in place** in the source text — never generated prose |
| 📄 **Document Scan** | A photo of a legal document | OCR → structured fields (case no., parties, IPC sections, dates) with per-field confidence |
| ✂️ **Summarization** | Full judgment text | Extractive summary, with the provenance of every selected sentence |
| 📚 **Precedent Search** | A natural-language query | Ranked past judgments with real similarity scores |
| 📊 **Model Insights** | — | Live evaluation metrics, baseline-vs-final comparisons, and calibration curves for all of the above |

**The Model Insights screen is the point.** Most ML demos hide their evaluation in a report nobody opens. Here it is a first-class screen, served live from the running backend — retrain a model, restart, and the app's numbers change with zero frontend edits.

---

## Stack

```mermaid
graph TB
    subgraph DESKTOP["🖥️  Desktop Shell"]
        TAURI["Tauri 2.x<br/><i>Rust core · OS webview</i>"]
    end

    subgraph FRONTEND["🎨  Frontend — app/"]
        REACT["React 18 + Vite<br/>TypeScript strict"]
        STYLE["Tailwind v4 · Radix / shadcn<br/>Framer Motion"]
        VIZ["Hand-rolled SVG charts<br/><i>d3-scale for math only</i>"]
        STATE["Zustand · React Query<br/>react-hook-form + zod"]
    end

    subgraph BACKEND["⚙️  Backend — backend/"]
        API["FastAPI · Pydantic v2<br/>uvicorn @ 127.0.0.1:8000"]
        SINGLE["Model singletons<br/><i>loaded once at startup</i>"]
    end

    subgraph MLMODELS["🧠  Models"]
        BAIL["Bail · LogReg → XGBoost → InLegalBERT"]
        QA["QA · InLegalBERT span head"]
        SUM["Summarizer · TextRank → classifier"]
        RET["Retrieval · FAISS + embeddings"]
        NER["NER · regex → spaCy"]
        OCR["OCR · Tesseract"]
    end

    subgraph TRAIN["🔬  Training — ml/"]
        DATA["Datasets"]
        EVAL["Evaluation<br/>reports/*.json + MODEL_CARD.md"]
    end

    TAURI -->|hosts| REACT
    REACT --- STYLE
    REACT --- VIZ
    REACT --- STATE
    REACT -->|"plugin-http · localhost only"| API
    API --> SINGLE
    SINGLE --> BAIL & QA & SUM & RET & NER & OCR
    DATA -->|trains| MLMODELS
    MLMODELS -->|weights| SINGLE
    EVAL -->|"metrics JSON"| API
    API -.->|"GET /metrics"| VIZ

    classDef shell fill:#14120F,stroke:#14120F,color:#F4F1EA
    classDef fe fill:#FBF9F4,stroke:#D6D1C4,color:#14120F
    classDef be fill:#FBF9F4,stroke:#D6D1C4,color:#14120F
    classDef ml fill:#F4F1EA,stroke:#4A6B57,color:#14120F
    classDef tr fill:#F4F1EA,stroke:#8A7420,color:#14120F
    class TAURI shell
    class REACT,STYLE,VIZ,STATE fe
    class API,SINGLE be
    class BAIL,QA,SUM,RET,NER,OCR ml
    class DATA,EVAL tr
```

---

## Workflow

Two independent loops meet at one boundary. `ml/` only ever **writes**; `backend/` only ever **reads**. The API process never trains.

```mermaid
flowchart LR
    subgraph OFFLINE["🔬  Training loop — run occasionally"]
        direction TB
        D1["Raw datasets<br/><i>ml/data · gitignored</i>"]
        D2["Preprocess<br/>dedupe → split"]
        D3["Train<br/>baseline → final"]
        D4["Evaluate<br/><i>held-out split only</i>"]
        D5[("backend/artifacts/<br/>weights · FAISS index")]
        D6[("ml/reports/*.json<br/>metrics + model cards")]
        D1 --> D2 --> D3 --> D4
        D4 --> D5
        D4 --> D6
    end

    subgraph RUNTIME["⚡  Request loop — every interaction"]
        direction TB
        R1["User acts<br/><i>predict · scan · ask · search</i>"]
        R2["React Query<br/>typed to the API contract"]
        R3["FastAPI route<br/>Pydantic validation"]
        R4["Warm model singleton"]
        R5["Response<br/><code>{ ok, data, error, latency_ms }</code>"]
        R6["Render + confidence<br/>+ disclaimer"]
        R1 --> R2 --> R3 --> R4 --> R5 --> R6
    end

    D5 -.->|"loaded once<br/>at startup"| R4
    D6 -.->|"served live by<br/>GET /metrics"| INSIGHTS

    INSIGHTS["📊 Model Insights screen<br/><i>baselines · calibration · fairness</i>"]
    R6 --> INSIGHTS

    classDef off fill:#F4F1EA,stroke:#8A7420,color:#14120F
    classDef run fill:#FBF9F4,stroke:#4A6B57,color:#14120F
    classDef store fill:#14120F,stroke:#14120F,color:#F4F1EA
    classDef ins fill:#14120F,stroke:#4A6B57,color:#F4F1EA
    class D1,D2,D3,D4 off
    class R1,R2,R3,R4,R5,R6 run
    class D5,D6 store
    class INSIGHTS ins
```

> The dotted lines are the whole architecture in one picture: **weights and metrics are the only things that cross from training into runtime.** Nothing is hardcoded, and nothing is trained inside the API.

---

## Design

Monochrome paper and ink, typewriter-styled — a judiciary aesthetic built from **Space Mono** (headings, and every machine-extracted identifier or measured number) and **Special Elite** (all prose and small text). The split is semantic: if it was extracted or measured by a model, it is set in mono, so you can always tell at a glance what the machine produced versus what a person wrote.

Floating cards over a grained paper canvas, a left rail that expands on hover and **pushes** content rather than covering it, rubber-stamp verdict badges, and a light/dark toggle whose transition wipes outward from the switch itself. Full token set and rules in [CLAUDE.md §5](CLAUDE.md).

### Screenshots

<!-- Added at the end of Phase 4. Startup · Home · Predict + Result · Scan · Search · Insights, in both themes. -->

*Coming with Phase 4.*

---

## Quickstart

**Prerequisites** — Node 18+, Rust (for Tauri), Python **3.11**, and [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) (`winget install UB-Mannheim.TesseractOCR` on Windows).

```bash
git clone https://github.com/SriramWorkSpace/NyayaSetu.git
cd NyayaSetu
```

```bash
# terminal 1 — backend
cd backend
py -3.11 -m venv .venv && .venv/Scripts/activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# terminal 2 — desktop app
cd app
npm install
npm run tauri dev        # or `npm run dev` for browser-only iteration
```

Models load once at backend startup, so the first request is already warm by the time uvicorn prints *Application startup complete*.

---

## Datasets & licensing

| Dataset | License | Used for |
|---|---|---|
| [IndianBailJudgments-1200](https://huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200) | **CC BY 4.0** | Bail prediction + fairness audit; its 1,200 source PDFs double as real test inputs for the scan module |
| [IL-TUR / ILDC / CJPE](https://huggingface.co/datasets/Exploration-Lab/IL-TUR) | **CC BY-NC** | Extractive QA gold spans (56-doc expert split) and the precedent-retrieval corpus |
| [InLegalBERT](https://huggingface.co/law-ai/InLegalBERT) | model weights | Shared backbone for bail, QA, NER, and domain embeddings |

> [!IMPORTANT]
> **IL-TUR is non-commercial.** While it is part of this project, NyayaSetu cannot be commercialized. See [decisions.md D-006](decisions.md).

---

## <a name="why-no-llm"></a>Why no generative AI?

Every predictive component here is **trained and evaluated in-house**. Bail prediction, QA, summarization, retrieval, and NER are real models with real, measured error rates — you can read every one of them on the Insights screen.

Exactly two touchpoints in the entire app call an external API, both purely cosmetic: rephrasing a search query, and turning a raw prediction into a readable sentence. **Neither affects any reported metric.**

This constraint is the project. Wrapping an LLM would produce answers that look better and mean nothing — there would be no baseline to beat, no calibration to check, and no honest way to say how often it is wrong. QA returns a **highlighted span inside the source judgment** rather than a chat bubble for exactly this reason: the interface should be honest about what the model actually does.

---

## <a name="privacy"></a>Privacy

Runs **entirely offline** after model download. No telemetry, no analytics, no crash reporting, no accounts. The backend binds to `127.0.0.1` only. Scanned documents are processed in memory and never persisted without an explicit save. Judgment text and case narratives are never written to logs. See [SECURITY.md](SECURITY.md).

---

## Project documents

| | |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full specification — scope, API contract, ML modules, quality floor |
| [plan.md](plan.md) | Phase-by-phase roadmap and current progress |
| [decisions.md](decisions.md) | Why things are the way they are |
| [CLAUDE.md](CLAUDE.md) | Working conventions — code style, design system, testing |
| [SECURITY.md](SECURITY.md) | Security policy, testing rulebook, and outcome log |

---

<div align="center">

**Sriram Madala** · B.Tech CSE, VIT

<sub>Not legal advice. An academic project.</sub>

</div>
