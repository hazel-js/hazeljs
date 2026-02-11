# RiskOS Demo

Demonstrates `@hazeljs/riskos` capabilities.

## Examples

### Quick demo (`npm start`)

1. **Policy deny** - requireTenant policy denies action when tenantId is missing
2. **KYC session** - create session, answer fields, run flow with mock sanctions provider
3. **Risk scoring** - evaluate ruleset with hard blocks and score rules
4. **Investigator assistant** - stub response with citations
5. **Audit & evidence pack** - traces written to memory sink, build evidence pack

### Full KYC Individual Onboarding (`npm run kyc:full`)

Complete KYC flow with **15 questions**:

| Category | Questions |
|----------|-----------|
| **Personal** | Full name, email, date of birth, nationality |
| **Address** | Street, city, postal code, country |
| **ID** | ID type (passport/national_id/drivers_license), ID number |
| **Compliance** | Tax residence, employment status, source of funds, PEP status, purpose of account |

Flow: Questions → Validation (JSON Schema) → Sanctions check → Doc verify → Transform → Verify → Decision.

Decision rules: APPROVED when sanctions clear, REVIEW for sanctions match or PEP, REJECTED if doc verification fails.

## Run

```bash
npm install
npm start          # Quick demo
npm run kyc:full   # Full KYC with question set
npm run prod       # Production example (requires DATABASE_URL)
```

For `npm run prod`: set `DATABASE_URL`, run migrations from `node_modules/@hazeljs/riskos/sql/migrations/`.
