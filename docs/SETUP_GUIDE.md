# Alice - Local Setup Guide 🛠️

Follow this step-by-step developer guide to configure your local runtime environment and boot the monorepos.

---

## 💻 Local Requirements
- **Node.js**: v20 LTS or higher
- **Package Manager**: npm v10 or higher
- **Redis Cache**: v7 or higher (Optional in development)
- **Supabase Account**: A free Supabase project to run migration files

---

## 🏃 STEP-BY-STEP Execution

### Step 1: Clone and Enter Directory
```bash
git clone https://github.com/sickn33/alice.git
cd alice
```

### Step 2: Configure Environment Variables
Copy templates and fill details:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 3: Run Database Migrations
1. In your Supabase Dashboard, enter your project's **SQL Editor**.
2. Click **New query** and copy the contents of `backend/migrations/001_initial_schema.sql`.
3. Click **Run** to execute the schema and provision enums, tables, indexes, triggers, and Row Level Security (RLS) rules.

### Step 4: Boot Services (Backend & Frontend)

#### Option A: Running with Docker Compose (Recommended)
Make sure Docker Desktop is active on your host:
```bash
docker-compose up --build
```
Access endpoints:
- **Painel Application**: `http://localhost:3001`
- **REST Engine API**: `http://localhost:3000/api`

#### Option B: Running Manually

##### 1. Start backend:
```bash
cd backend
npm install
npm run dev
```

##### 2. Start frontend:
```bash
cd ../frontend
npm install
npm run dev
```
Access in your browser: `http://localhost:3001`
