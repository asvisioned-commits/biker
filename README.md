# 🚴 Biker

**Zimbabwe's trust-first peer-to-peer logistics platform.**

Send items, buy groceries, pick up food, run errands — all with protected payments, verified riders, and provable delivery chains.

## The Core Promise

| 🛡️ Money protected | ✓ Riders verified | 📸 Delivery provable | ⚖️ Disputes resolvable | 👁️ Everything visible |
|---|---|---|---|---|

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, CSS Modules
- **Auth**: Supabase Auth (Google OAuth, Email, Phone OTP)
- **Database**: Supabase (PostgreSQL + RLS + Realtime)
- **Design System**: "Calm Trust" — semantic tokens, Inter font, layered shadows
- **Maps**: Leaflet.js (coming soon)

## Services

| Service | Description |
|---|---|
| 📦 **Send Item** | Point-to-point delivery with proof chain |
| 🛒 **Buy For Me** | Shopping + delivery with receipt OCR |
| 🏪 **Pick Up Order** | Collect from merchants |
| 📄 **Document Run** | Queue at offices, return with documents |
| ⏳ **Queue Service** | Wait in line on your behalf |
| 📍 **Multi-Stop** | Multiple pickups/dropoffs in one trip |

## Speed Modes

| Mode | Description |
|---|---|
| 🚴 Standard | Regular delivery |
| ⚡ Biker Jet | Priority dispatch, fastest rider, premium rate |
| 📅 Scheduled | Book for a future time slot |

## Protection Levels

| Level | What's Protected |
|---|---|
| None | Cash on delivery — no escrow |
| 🛡️ Protected | PIN-verified delivery, escrow hold, dispute eligible |
| 🛡️+ Protect Plus | Insurance, priority dispute, photo+signature required |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add your Supabase URL, anon key, and Google OAuth credentials

# Run development server
npm run dev
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEV_MODE=true  # Set false in production
```

## Project Structure

```
src/
├── app/
│   ├── auth/callback/       # OAuth callback handler
│   ├── dashboard/
│   │   ├── addresses/       # Saved addresses
│   │   ├── disputes/        # Dispute management
│   │   ├── earnings/        # Rider earnings dashboard
│   │   ├── jobs/            # Available jobs (rider)
│   │   ├── order/new/       # 5-step booking flow
│   │   ├── orders/          # Order history
│   │   └── tracking/        # Live order tracking
│   ├── login/               # Login (Google, Email, Phone)
│   └── signup/              # Multi-step signup with KYC
├── lib/
│   ├── auth.ts              # Auth utilities (dual dev/prod mode)
│   ├── database.ts          # Supabase query layer
│   ├── realtime.ts          # Live tracking hooks
│   └── supabase/            # Supabase client setup
├── types/                   # TypeScript domain types
└── globals.css              # Design system tokens
```

## Database

Full schema in `supabase/migrations/001_initial_schema.sql`:
- 20+ tables with Row Level Security
- Double-entry ledger system (escrow)
- Trust scoring and ratings
- Audit logging

---

Built for Zimbabwe 🇿🇼
