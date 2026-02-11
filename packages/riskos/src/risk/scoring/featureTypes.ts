/**
 * Feature types for risk scoring signals
 */

/** Event signal types */
export interface TransactionSignal {
  type: 'transaction';
  amount: number;
  currency?: string;
  counterparty?: string;
  country?: string;
  [key: string]: unknown;
}

export interface AlertSignal {
  type: 'alert';
  severity: string;
  ruleId?: string;
  [key: string]: unknown;
}

export interface DeviceSignal {
  type: 'device';
  fingerprint?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface GeoSignal {
  type: 'geo';
  country?: string;
  city?: string;
  [key: string]: unknown;
}

export type RiskSignal = TransactionSignal | AlertSignal | DeviceSignal | GeoSignal | Record<string, unknown>;
