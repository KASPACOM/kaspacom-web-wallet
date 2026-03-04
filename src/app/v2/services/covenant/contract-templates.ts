import { CtorArg } from './template-patcher.service';

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  assetPath: string;
  fields: TemplateField[];
  placeholderArgs: CtorArg[];
}

export interface TemplateField {
  paramName: string;
  label: string;
  type: 'address' | 'int_days' | 'int_timestamp' | 'int_count' | 'hash32';
  placeholder: string;
  description: string;
  helpUrl?: string;
}

const byteArrayArg = (bytes: number[]): CtorArg => ({
  kind: 'array',
  data: bytes.map((value) => ({ kind: 'byte' as const, data: value })),
});

const intArg = (value: number): CtorArg => ({
  kind: 'int',
  data: value,
});

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'time-lock-vault',
    name: 'Time-Lock Vault',
    description: 'Funds locked until a date. Owner can spend anytime; recovery address can spend after timeout.',
    icon: '🔒',
    assetPath: 'assets/covenant-templates/time-lock-vault.json',
    fields: [
      {
        paramName: 'owner',
        label: 'Owner Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Address that can spend the vault immediately.',
      },
      {
        paramName: 'recovery',
        label: 'Recovery Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Fallback address that can spend after the timeout passes.',
      },
      {
        paramName: 'timeout',
        label: 'Unlock Timestamp',
        type: 'int_timestamp',
        placeholder: '1735689600',
        description: 'Unix timestamp in seconds. Automatically converted to milliseconds for Kaspa consensus compatibility.',
        helpUrl: 'https://www.epochconverter.com/',
      },
    ],
    placeholderArgs: [
      byteArrayArg([170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201]),
      byteArrayArg([187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177, 176, 175, 174, 173, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161, 160, 159, 158, 157, 156]),
      intArg(1000000000000),
    ],
  },
  {
    id: 'multi-sig-vault',
    name: '2-of-3 MultiSig Vault',
    description: 'Requires 2 of 3 signers to spend. Any 2-of-3 combination works.',
    icon: '🔑',
    assetPath: 'assets/covenant-templates/multi-sig-vault.json',
    fields: [
      {
        paramName: 'key1',
        label: 'Signer 1 Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'First signer allowed in the vault quorum.',
      },
      {
        paramName: 'key2',
        label: 'Signer 2 Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Second signer allowed in the vault quorum.',
      },
      {
        paramName: 'key3',
        label: 'Signer 3 Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Third signer allowed in the vault quorum.',
      },
    ],
    placeholderArgs: [
      byteArrayArg([204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235]),
      byteArrayArg([221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252]),
      byteArrayArg([238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    ],
  },
  {
    id: 'escrow-with-arbiter',
    name: 'Escrow with Arbiter',
    description: 'Buyer and seller escrow with an arbiter who can split funds on dispute.',
    icon: '🤝',
    assetPath: 'assets/covenant-templates/escrow-with-arbiter.json',
    fields: [
      {
        paramName: 'buyer',
        label: 'Buyer Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Buyer address for cooperative release and refund rights.',
      },
      {
        paramName: 'seller',
        label: 'Seller Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'Seller address for cooperative release.',
      },
      {
        paramName: 'arbiterHash',
        label: 'Arbiter Public Key Hash',
        type: 'hash32',
        placeholder: '0x...',
        description: 'The blake2b-256 hash of the arbiter\'s public key (32 bytes hex). The arbiter is the trusted third party who can resolve disputes and release funds to either buyer or seller.',
      },
      {
        paramName: 'expiry',
        label: 'Refund Expiry Timestamp',
        type: 'int_timestamp',
        placeholder: '1735689600',
        description: 'Unix timestamp in seconds. Automatically converted to milliseconds for Kaspa consensus.',
        helpUrl: 'https://www.epochconverter.com/',
      },
    ],
    placeholderArgs: [
      byteArrayArg([170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201]),
      byteArrayArg([187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218]),
      byteArrayArg([204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235]),
      intArg(1000000000000),
    ],
  },
  {
    id: 'dead-mans-switch',
    name: "Dead Man's Switch",
    description: 'Inheritance contract. Owner calls keepAlive periodically to prove they\'re active. If owner stops calling keepAlive for the inactivity period, the heir can claim all funds.',
    icon: '⏳',
    assetPath: 'assets/covenant-templates/dead-mans-switch.json',
    fields: [
      {
        paramName: 'owner',
        label: 'Owner Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'The owner must call keepAlive at least once per inactivity period to keep funds locked. Can also reclaim funds anytime.',
      },
      {
        paramName: 'heir',
        label: 'Heir Address',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description: 'If the owner fails to call keepAlive within the inactivity period, the heir can claim all funds. Think of this as your inheritance beneficiary.',
      },
      {
        paramName: 'initInactivityPeriod',
        label: 'Inactivity Period (days)',
        type: 'int_days',
        placeholder: '30',
        description: 'How many days the owner can be inactive before the heir can claim. For example: 30 days means the owner must call keepAlive at least once every 30 days.',
      },
    ],
    placeholderArgs: [
      byteArrayArg([170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201]),
      byteArrayArg([187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218]),
      intArg(86400),
    ],
  },
];
