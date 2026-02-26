# @hazeljs/contracts

**Shared event contracts and context types for HazelJS modules**

Provides common event types, data classification enums, and context interfaces used across HazelJS packages (core, riskos, agent, etc.).

[![npm version](https://img.shields.io/npm/v/@hazeljs/contracts.svg)](https://www.npmjs.com/package/@hazeljs/contracts)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/contracts)](https://www.npmjs.com/package/@hazeljs/contracts)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Installation

```bash
npm install @hazeljs/contracts
```

## Exports

- **Events** – `HazelEvent`, `isHazelEvent` type guard, metric/span/audit/dataAccess/aiCall/decision event types
- **Classification** – `DataClassification`, `RiskLevel`, `DecisionStatus` enums
- **Context** – Shared context types for request/tenant/actor metadata

## Usage

```ts
import {
  DataClassification,
  RiskLevel,
  DecisionStatus,
  isHazelEvent,
  type HazelEvent,
} from '@hazeljs/contracts';

// Enums
DataClassification.PUBLIC;   // 'PUBLIC'
RiskLevel.HIGH;              // 'HIGH'
DecisionStatus.APPROVED;    // 'APPROVED'

// Type guard
if (isHazelEvent(payload)) {
  // payload is HazelEvent
}
```

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
