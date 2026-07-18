# Datalyze AI — Intelligent Data Analytics Platform

Datalyze AI is an industry-grade, multi-tenant data analytics, auto-healing, and automated reporting platform. Built entirely using an open-source stack, the application empowers users to ingest raw operational datasets, view dynamic cross-filtering visualizations, execute automated data cleansing pipelines, and configure real-time background email summaries.

---

## 🏗️ Architecture & Technical Stack

The platform is designed around a clean separation of concerns, decoupling the reactive client-side presentation layer from the asynchronous processing core.

### 1. Frontend Interface (`/frontend`)
*   **Core Framework:** React 18+ with TypeScript (Enforcing strict, compile-time type safety)
*   **Build Tooling:** Vite (Optimized production bundling and fast Hot Module Replacement)
*   **Styling Engine:** Tailwind CSS (Utility-first framework configured for responsive, dashboard-centric grids)
*   **Data Visualization:** Recharts (SVG-based charting library configured for custom client-side state cross-filtering)
*   **HTTP Client:** Axios (Configured with global interceptors for automated JWT authorization header injection)

### 2. Backend Service Layer (`/backend`)
*   **Core Framework:** Python 3.10+ & FastAPI (Fully typed request validation via Pydantic v2 schemas)
*   **Database Infrastructure:** SQLite utilizing asynchronous SQLAlchemy (`aiosqlite` dialect)
*   **Security Framework:** Self-contained OAuth2 with JWT tokens (`python-jose` signatures & `passlib` with `bcrypt` password hashing)
*   **Data Diagnostics Engine:** Pandas for deep structural file profiling, data health scoring, and auto-cleansing logic
*   **Mailing System:** Asynchronous SMTP integration hooks for dynamic, frequency-based executive digest dispatches

---

## 📂 Project Directory Structure

```text
Datalyze/
├── frontend/               # React Web Application Layer
│   ├── src/
│   │   ├── assets/         # Branding SVG vectors and static media assets
│   │   ├── components/     # Reusable UI primitives and layout structures
│   │   │   ├── layout/     # Navigation rails, Sidebars, and Page wrappers
│   │   │   └── ui/         # Buttons, Inputs, Form fields, and Modals
│   │   ├── context/        # React Context hooks (AuthContext, WorkspaceContext)
│   │   ├── routes/         # Protected routing engine and authentication guards
│   │   ├── services/       # Client-side endpoint connectors mapping to the API
│   │   └── views/          # High-level feature view modules
│   │       ├── LoginView.tsx        # Authentication & Registration view
│   │       ├── DashboardView.tsx    # 4-Quadrant cross-filtering metrics canvas
│   │       ├── IntegrationsView.tsx # SMTP controls and digest dispatch toggles
│   │       └── UserGuide.tsx        # Initial post-login onboarding interface
│   ├── package.json        # Node modules and build script specifications
│   ├── tsconfig.json       # TypeScript compiler strict layout guidelines
│   └── vite.config.ts      # Vite build pipeline and localized endpoint proxies
│
├── backend/                # FastAPI Application Core
│   ├── app/
│   │   ├── api/            # API Route Routing Layout
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py          # User management, JWT token issue, RBAC verification
│   │   │   │   │   ├── dashboard.py     # Aggregated metric endpoints & CSV reporting utilities
│   │   │   │   │   └── integrations.py  # SMTP digest configuration and trigger handlers
│   │   │   │   └── router.py            # API V1 router entrypoint aggregator
│   │   │   └── deps.py     # Dependency injections (DB session pools, User resolvers)
│   │   ├── core/           # Platform Configuration files
│   │   │   ├── config.py   # Pydantic BaseSettings environment runtime parser
│   │   │   ├── database.py # SQLAlchemy Async Engine and declarative Base mapping
│   │   │   └── security.py # Hashing utilities and bearer encryption matrices
│   │   ├── models/         # Declarative SQLAlchemy Database Models
│   │   ├── schemas/        # Pydantic validation structures
│   │   └── services/       # Deep data business logic layers
│   │       └── doctor.py   # Automated file parsing and database alignment pipelines
│   ├── requirements.txt    # Pinned Python package dependencies
│   ├── .env                # Core environment credential variable storage
│   └── main.py             # FastAPI entrypoint initialization file
│
└── README.md               # Master unified project documentation

🚀 Installation & Local Environment Setup
1. Prerequisites
Ensure your local environment has the following runtimes installed:

Node.js (v18.0.0 or higher)

Python (v3.10.0 or higher)

Package Managers: npm (bundled with Node) and pip (bundled with Python)

2. Backend Service Setup
Open a terminal and navigate into the backend workspace directory:

Bash
cd backend
Install all required pinned dependencies:

Bash
pip install -r requirements.txt
Create your localized configuration environment file (.env) in the backend/ root folder:

Ini, TOML
# Database Configurations
DATABASE_URL="sqlite+aiosqlite:///./datalyze.db"

# Security Configurations
SECRET_KEY="DATALYZE_AI_REPLACE_WITH_A_SECURE_RANDOM_HASH_STRING_FOR_JWT"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALLOWED_ORIGINS="http://localhost:3000,[http://127.0.0.1:3000](http://127.0.0.1:3000)"

# SMTP Live Mail Server Credentials
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-corporate-sender-email@gmail.com"
SMTP_PASSWORD="your-secure-google-app-password"
SMTP_FROM="your-corporate-sender-email@gmail.com"
Start up the FastAPI development backend via Uvicorn:

Bash
python -m uicorn app.main:app --reload --port 8000
The interactive API documentation matrix will be running at http://127.0.0.1:8000/docs.

3. Frontend Interface Setup
Open a second terminal window and navigate into the frontend workspace directory:

Bash
cd frontend
Cleanly install the frontend node packages modules:

Bash
npm install
Verify that your localized application network proxy in vite.config.ts points correctly to the backend port (8000):

TypeScript
proxy: {
  '/api': {
    target: '[http://127.0.0.1:8000](http://127.0.0.1:8000)',
    changeOrigin: true,
    secure: false,
  }
}
Boot up the Vite reactive client-side server environment:

Bash
npm run dev
Launch your web browser and load the application portal link: http://localhost:3000.

💡 Core System Features Matrix
Dynamic Client-Side Cross-Filtering Canvas: Clicking into a specific chart visualization coordinate node (e.g., a specific Branch bar) forces a state synchronization context across the app. The KPI summary cards (Total Sales, Gross Profit, Tax) and remaining visuals dynamically recalculate their metrics in real-time.

Automatic User Workspace Provisioning: Brand new user sign-ups automatically generate a localized individual tenant workspace structure. This maps correct Role-Based Access Control (RBAC) ownership arrays immediately, eliminating detached permissions or account lockouts.

Tailored Email Digest Customization: The system integrations dashboard passes chosen scheduling parameters (Daily, Weekly, Monthly) straight to backend text generation mapping routines, dispatching tailored operational alerts safely using Google SMTP App Password channels.

Onboarding Routing Flow Guards: Upon initial successful validation verification, application routing maps push users onto an explicit instructional User Guide workspace matrix first rather than standard charts, streamlining user onboarding.

Pruned Workspace Cleansing: Deleting the local datalyze.db file instantly allows developers or validation engineers to step through registration, workspace context creation, and data ingestion entirely from scratch.

How to Run the Project:
Backend :
python -m uvicorn app.main:app --reload --port 8000

Frontend :
npm run dev

