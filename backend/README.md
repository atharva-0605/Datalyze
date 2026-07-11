# Datalyze AI - Backend Service

Datalyze AI is an intelligent data analytics platform. This repository contains the FastAPI production-ready, industry-grade backend service built from scratch using a 100% free, open-source stack.

---

## Technical Stack Overview

- **Core Framework:** Python 3.10+ & [FastAPI](https://fastapi.tiangolo.com/) (fully typed using Pydantic v2)
- **Database Engine:** PostgreSQL via asynchronous connection (`SQLAlchemy` / `asyncpg` / `aiosqlite` dev fallback)
- **Security:** Self-contained OAuth2 with JWT tokens (`python-jose` & `passlib` with `bcrypt`)
- **Data Ingestion:** Asynchronous multi-tenant streaming & local disk mock Object Storage interface
- **AI Data Doctor:** Pandas & Polars for advanced file profiling, health scoring, and auto-healing
- **PDF Report Engine:** Jinja2 templating compiled to PDF via [WeasyPrint](https://weasyprint.org/)
- **AI Layer Hook:** Ready-to-go API wrapper hook for local [Ollama](https://ollama.com/) LLM inference

---

## Directory Architecture

```text
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py         # User Registration, Login, JWT auth, RBAC checks
│   │   │   │   ├── datasets.py     # Upload, list, query, and trigger dataset healing
│   │   │   │   ├── reports.py      # Generate and download PDF profiling reports
│   │   │   │   └── health.py       # DB, disk, and AI layer health metrics
│   │   │   └── router.py           # v1 Endpoint router aggregator
│   │   └── deps.py                 # Dependency injections (Auth, DB session, Roles)
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings environment parsing
│   │   ├── database.py             # SQLAlchemy Async Engine, Session, and DB fallbacks
│   │   ├── security.py             # JWT signatures and Bcrypt hashing functions
│   │   └── ollama.py               # Async Ollama client hook
│   ├── models/                     # Declarative SQLAlchemy models
│   │   ├── base.py
│   │   ├── user.py
│   │   ├── workspace.py
│   │   └── dataset.py
│   ├── schemas/                    # Pydantic v2 validation models
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── workspace.py
│   │   ├── dataset.py
│   │   └── report.py
│   ├── services/                   # Deep business logic layer
│   │   ├── doctor.py               # Profiling, scoring, and data cleansing logic
│   │   ├── ingestion.py            # Stream-based file uploading
│   │   └── report_engine.py        # Jinja HTML template compilation to PDF
│   ├── main.py                     # Main FastAPI App init and CORS configs
│   └── database_init.py            # Automatic startup table migration script
├── requirements.txt                # Pinned library dependencies
├── .env                            # Environment configurations
└── README.md                       # Setup and developer documentation
```

---

## Installation & Setup

### 1. Pre-requisites
- **Python 3.10+** installed on your system.
- **PostgreSQL** database (optional; if offline, the backend automatically provisions a local SQLite DB `sqlite+aiosqlite:///./datalyze_fallback.db` to prevent crashes).

### 2. WeasyPrint GTK+ Dependencies (Windows)
WeasyPrint requires the **GTK+** runtime library for PDF rendering.
1. Download the latest GTK3 installer for Windows from: [GitHub - tschoonj/GTK-for-Windows-Runtime-Environment-Installer](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases).
2. Run the installer and ensure you check the box to **"Add GTK+ to system PATH"**.
3. Restart your terminal or system to reload the PATH settings.
*Note: If GTK+ is missing, the backend will generate a standalone HTML report instead of PDF, preventing service runtime crashes.*

### 3. Clone and Install Dependencies
Navigate to your project root folder and run:
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
A `.env` file has been created at the root with standard settings. You can edit this file to change credentials:
```ini
# Security
SECRET_KEY="datalyze_ai_super_secret_jwt_sign_key_do_not_use_in_production"
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Database Connection (Adjust to your PostgreSQL details)
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/datalyze"

# Storage
STORAGE_DIR="./storage"

# Ollama API Configuration
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3"
```

### 5. Run local Ollama (Optional)
If you wish to utilize local AI inference:
1. Download Ollama from [ollama.com](https://ollama.com).
2. Start the Ollama desktop service or run `ollama serve`.
3. Pull a model (e.g., `ollama pull llama3`).

---

## Running the Application

Launch the FastAPI backend server using `uvicorn`:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once running, navigate to:
- **Interactive Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (Swagger UI)
- **Alternative Docs:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) (Redoc UI)

---

## Core API Flow Guide

### 1. Multi-Tenant User Authentication
- **Create Account:** Send a `POST` request to `/api/v1/auth/register` passing `email`, `password`, and optional `workspace_name` or `role`. If no workspace is provided, a personal tenant workspace is created for you.
- **Login:** Send a `POST` request to `/api/v1/auth/login` as form-data containing `username` (email) and `password`. It returns a JWT access token.
- **Set Header:** Include `Authorization: Bearer <your_jwt_token>` in all subsequent requests.

### 2. Dataset Ingestion & Profiling
- **Upload File:** Send a `POST` request to `/api/v1/datasets/upload` containing a `multipart/form-data` file. Supported formats: **CSV, Excel (.xlsx, .xls), and JSON**.
- This endpoint streams the file to the local storage, executes the **AI Data Doctor** diagnostics profile to compute row/column counts, types, duplicate/missing indexes, and computes a **Data Health Score (0-100)**.

### 3. Auto-Healing
- **Trigger Heal:** Send a `POST` request to `/api/v1/datasets/{dataset_uuid}/heal` with the dataset's UUID.
- This creates a cleaned version of the dataset by removing duplicate rows, filling empty numeric cells with the column mean, and filling non-numeric empty cells with the column mode. It returns a JSON diff of the changes and registers the new clean dataset.

### 4. PDF Quality Audit Report
- **Generate PDF:** Send a `POST` request to `/api/v1/reports/generate` with the `dataset_uuid` and optional report `title`.
- This renders a responsive Jinja HTML document and compiles it into a professional PDF report using WeasyPrint, returning a streamable download.
