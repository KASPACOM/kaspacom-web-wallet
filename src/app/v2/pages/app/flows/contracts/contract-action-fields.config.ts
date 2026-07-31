export type ActionFieldType =
  | 'address'
  | 'amount'
  | 'timestamp'
  | 'extra-int'
  | 'extra-bool'
  | 'banner';

interface ActionFieldBase {
  type: ActionFieldType;
  description?: string;
}

export interface AddressActionField extends ActionFieldBase {
  type: 'address';
  key: 'outputAddress';
  label: string;
  placeholder?: string;
}

export interface AmountActionField extends ActionFieldBase {
  type: 'amount';
  key: 'outputAmount' | 'topUpAmount';
  label: string;
  allowMax?: boolean;
  min?: string;
}

export interface TimestampActionField extends ActionFieldBase {
  type: 'timestamp';
  key: 'dmsNewExpiry';
  label: string;
}

export interface ExtraIntActionField extends ActionFieldBase {
  type: 'extra-int';
  paramName: string;
  label: string;
}

export interface ExtraBoolActionField extends ActionFieldBase {
  type: 'extra-bool';
  paramName: string;
  label: string;
}

export interface BannerActionField extends ActionFieldBase {
  type: 'banner';
  tone: 'info' | 'warning';
  text: string;
}

export type ActionField =
  | AddressActionField
  | AmountActionField
  | TimestampActionField
  | ExtraIntActionField
  | ExtraBoolActionField
  | BannerActionField;

export interface ActionFieldConfigEntry {
  fields: ActionField[];
  /**
   * Suppresses the generic ABI extra-arg loop (extraArgsForFunction()) for
   * this action — set true where an extra arg is already covered by `fields`
   * (escrow arbitrate's amountToSeller) or isn't collectible generically
   * (DMS keepAlive), matching extraArgsForFunction()'s own exclusions.
   */
  suppressGenericExtraArgs?: boolean;
}

export type ContractActionFieldConfig = Record<
  string /* normalized contract name */,
  Record<string /* fnName */, ActionFieldConfigEntry>
>;

const TOP_UP_FIELDS: ActionField[] = [
  {
    type: 'amount',
    key: 'topUpAmount',
    label: 'Top up amount (KAS)',
  },
  {
    type: 'banner',
    tone: 'info',
    text: 'The current covenant UTXO will be spent and recreated as output 0 with the same covenant ID. The new covenant amount will be the current balance plus the top-up amount before any contract-paid fee deduction.',
  },
];

const WITHDRAW_FIELDS: ActionField[] = [
  { type: 'address', key: 'outputAddress', label: 'Send to' },
  {
    type: 'amount',
    key: 'outputAmount',
    label: 'Withdraw amount (KAS)',
    allowMax: true,
  },
];

export const CONTRACT_ACTION_FIELDS: ContractActionFieldConfig = {
  DeadManSwitch: {
    keepAlive: {
      fields: [
        {
          type: 'timestamp',
          key: 'dmsNewExpiry',
          label: 'New check-in deadline',
          description:
            'Pick when the heir should become able to claim if you do not refresh again.',
        },
        {
          type: 'banner',
          tone: 'info',
          text: "A new Dead Man's Switch contract will be generated with the same owner and heir but the updated expiry. Funds will move to the new contract in the same transaction. The covenant lineage is preserved.",
        },
      ],
      suppressGenericExtraArgs: true,
    },
    claim: {
      // No amount field: leaving a remainder locked in the same DMS script
      // would let the (presumably unresponsive) owner call keepAlive on it —
      // DMS keepAlive has no deadline check — permanently blocking the heir
      // from ever claiming it. The heir always claims the full balance.
      fields: [
        { type: 'address', key: 'outputAddress', label: 'Send to' },
        {
          type: 'banner',
          tone: 'info',
          text: 'Claiming always transfers the full locked balance — partial claims are not allowed, so the owner cannot re-arm the deadline on a leftover balance.',
        },
      ],
    },
    topUp: { fields: TOP_UP_FIELDS },
    changeHeir: {
      fields: [
        {
          type: 'address',
          key: 'outputAddress',
          label: 'New Heir Wallet',
          placeholder: 'Enter heir wallet address or KNS domain',
        },
        {
          type: 'banner',
          tone: 'info',
          text: 'Funds stay locked in the covenant. Only the heir wallet changes.',
        },
      ],
    },
  },
  TimeLockVault: {
    spend: { fields: WITHDRAW_FIELDS },
    recover: { fields: WITHDRAW_FIELDS },
    topUp: { fields: TOP_UP_FIELDS },
  },
  MultiSigVault: {
    spend12: { fields: WITHDRAW_FIELDS },
    spend13: { fields: WITHDRAW_FIELDS },
    spend23: { fields: WITHDRAW_FIELDS },
    topUp: { fields: TOP_UP_FIELDS },
  },
  EscrowWithArbiter: {
    release: { fields: WITHDRAW_FIELDS },
    refund: { fields: WITHDRAW_FIELDS },
    topUp: { fields: TOP_UP_FIELDS },
    arbitrate: {
      fields: [
        {
          type: 'amount',
          key: 'outputAmount',
          label: 'Amount to seller (KAS)',
          description:
            'The remaining balance is automatically sent to the buyer. Arbitrate always pays out both sides.',
        },
      ],
      suppressGenericExtraArgs: true,
    },
  },
};
