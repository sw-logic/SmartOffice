# Company Management System

A comprehensive web-based company management system for managing clients, employees, projects, finances, price lists, and offers. Built with SvelteKit, TypeScript, and PostgreSQL.

## Features

- **Client Management** - Track clients with contacts, projects, and financial history
- **Employee Management** - Manage employees with optional system access
- **Vendor Management** - Track vendors and supplier relationships
- **Project Management** - Projects with tasks, team assignments, and budgets
- **Financial Tracking** - Income, expenses, and payment management
- **Price Lists** - Product/service catalogs with pricing
- **Offers/Quotes** - Professional offer generation with PDF export
- **Role-Based Access Control** - Fine-grained permission system
- **Audit Logging** - Complete activity trail
- **Dark/Light Mode** - Theme support

## Tech Stack

- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7
- **Authentication**: Auth.js
- **UI Components**: shadcn-svelte
- **Styling**: TailwindCSS 4

## Prerequisites

- Node.js 20.x LTS or higher
- Docker and Docker Compose (for PostgreSQL)
- npm or pnpm

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd SmartOffice
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/company_management"

# Auth.js
AUTH_SECRET="generate-a-secure-random-string-here"
AUTH_TRUST_HOST=true

# SMTP Configuration (for sending emails)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="noreply@yourcompany.com"

# File Storage
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"

# Application
NODE_ENV="development"
```

Generate a secure AUTH_SECRET:

```bash
openssl rand -base64 32
```

### 3. Start PostgreSQL Database

```bash
docker-compose up -d
```

This starts PostgreSQL 16 on port 5432 with:
- Database: `company_management`
- User: `postgres`
- Password: `postgres`

### 4. Initialize Database

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:push
```

### 5. Seed Initial Data

```bash
npm run db:seed
```

This creates:
- Default permissions and user groups (Admin, Manager, Accountant, Employee)
- Default company
- Admin user: `admin@example.com` / `admin123`

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run dev -- --open` | Start dev server and open browser |
| `npm run check` | Run TypeScript and Svelte checks |
| `npm run check:watch` | Run checks in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database (dev) |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:reset` | Reset database (WARNING: deletes all data) |

### Production

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Docker Commands

```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f

# Reset database (delete volume)
docker-compose down -v
```

## Project Structure

```
SmartOffice/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/        # shadcn-svelte components
│   │   │   ├── layout/    # Layout components
│   │   │   └── shared/    # Shared components
│   │   ├── server/        # Server utilities
│   │   │   ├── prisma.ts  # Prisma client
│   │   │   ├── access-control.ts
│   │   │   ├── audit.ts
│   │   │   └── email.ts
│   │   ├── stores/        # Svelte stores
│   │   └── utils/         # Utility functions
│   ├── routes/
│   │   ├── (auth)/        # Public auth routes
│   │   ├── (app)/         # Protected app routes
│   │   └── api/           # API routes
│   └── hooks.server.ts    # Auth hooks
├── docker-compose.yml
├── .env.example
└── CLAUDE.md              # Development blueprint
```

## Default User Groups & Permissions

| Group | Description |
|-------|-------------|
| **Admin** | Full access to all modules |
| **Manager** | Read all, write to clients/projects/offers, read finances |
| **Accountant** | Full finances access, read-only on clients/projects |
| **Employee** | Read clients/projects, limited finances view |

## Troubleshooting

### Database Connection Error

1. Ensure Docker is running: `docker ps`
2. Check PostgreSQL container: `docker-compose logs db`
3. Verify DATABASE_URL in `.env`

### Prisma Errors

```bash
# Regenerate Prisma client
npm run db:generate

# Reset and reseed database
npm run db:reset
npm run db:seed
```

### Port Already in Use

```bash
# Find process using port 5173
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Authentication Issues

1. Ensure AUTH_SECRET is set in `.env`
2. Clear browser cookies
3. Restart dev server

## Contributing

1. Create a feature branch
2. Make changes following the patterns in CLAUDE.md
3. Run `npm run check` and `npm run lint`
4. Submit a pull request

## License

Private - All rights reserved
