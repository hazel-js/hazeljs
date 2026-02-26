# RiskOS Demo

Demonstrates `@hazeljs/riskos` capabilities.

## Examples

### Quick demo (`npm start`)

1. **Policy deny** - requireTenant policy denies action when tenantId is missing
2. **KYC session** - create session, answer fields, run flow with mock sanctions provider
3. **Risk scoring** - evaluate ruleset with hard blocks and score rules
4. **Investigator assistant** - stub response with citations
5. **Audit & evidence pack** - traces written to memory sink, build evidence pack

### AI Investigator (`npm run investigator`)

Full LLM-powered investigator using `@hazeljs/riskos-agent`. Requires `OPENAI_API_KEY`.

### Interactive Chat (`npm run chat`)

**Full KYC onboarding + investigator.** Type `/start kyc` to begin the 15-question KYC flow, then ask the investigator anything. Streaming AI responses. Commands: `/start kyc`, `/refresh`, `/quit`.

### Full KYC Individual Onboarding (`npm run riskos:kyc`)

Complete KYC flow with **15 questions**:

| Category | Questions |
|----------|-----------|
| **Personal** | Full name, email, date of birth, nationality |
| **Address** | Street, city, postal code, country |
| **ID** | ID type (passport/national_id/drivers_license), ID number |
| **Compliance** | Tax residence, employment status, source of funds, PEP status, purpose of account |

Flow: Questions → Validation (JSON Schema) → Sanctions check → Doc verify → Transform → Verify → Decision.

Decision rules: APPROVED when sanctions clear, REVIEW for sanctions match or PEP, REJECTED if doc verification fails.

### KYB Merchant Onboarding (`npm run riskos:kyb`)

Merchant/business onboarding for PSPs with **10 questions**:

| Category | Questions |
|----------|-----------|
| **Business** | Business name, registration number, country, legal structure |
| **Processing** | MCC, expected monthly volume, settlement currency |
| **UBO** | UBO name, role, nationality |

Flow: Questions → Validation → Sanctions (business + UBO) → Transform → Decision.

**External APIs** — Use `FetchHttpProvider` with real providers: Trulioo, ComplyCube, Onfido, Jumio (KYC/identity); ComplyAdvantage, LSEG World-Check, OFAC-API (sanctions/AML); ARGOS Identity, BlinkID, IDEMIA (document/liveness). See [package docs](https://hazeljs.com/docs/packages/riskos#compatible-external-apis).

### PSP Transaction Risk (`npm run riskos:psp:transaction`)

Real-time transaction risk scoring with approve/review/decline:

- **Hard blocks**: High-risk country, gambling MCC, velocity limit (20+ txns/24h)
- **Score rules**: Amount tiers, velocity (1h), card country mismatch, new merchant
- Output: Score, level (LOW/MEDIUM/HIGH), decision, reasons

### PSP Chargeback Investigation (`npm run riskos:psp:chargeback`)

AI-powered dispute investigation. Requires `OPENAI_API_KEY`.

Uses investigator agent + KYC store + evidence pack + transaction timeline to review disputed transactions and summarize merchant data and evidence.

## Run

From the `example` directory (root of this app):

```bash
npm install
npm run riskos              # Quick demo
npm run riskos:kyc          # Full KYC individual onboarding
npm run riskos:kyb          # KYB merchant onboarding
npm run riskos:investigator # AI investigator (requires OPENAI_API_KEY)
npm run riskos:chat         # Interactive streaming chat
npm run riskos:psp:transaction  # Transaction risk scoring
npm run riskos:psp:chargeback   # Chargeback investigation (requires OPENAI_API_KEY)
npm run riskos:prod         # Production example (requires DATABASE_URL)
```

For `npm run riskos:prod`: set `DATABASE_URL`, run migrations from `node_modules/@hazeljs/riskos/sql/migrations/`.
