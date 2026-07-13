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
    description:
      'Lock funds with your wallet as owner and a backup wallet that can recover after a chosen date.',
    icon: '🔒',
    assetPath: 'assets/covenant-templates/time-lock-vault.json',
    fields: [
      {
        paramName: 'owner',
        label: 'Owner wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Your selected wallet. It can spend the vault immediately.',
      },
      {
        paramName: 'recovery',
        label: 'Recovery wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Fallback wallet that can spend after the unlock date passes.',
      },
      {
        paramName: 'timeout',
        label: 'Recovery unlock date',
        type: 'int_timestamp',
        placeholder: '',
        description:
          'The date and time when the recovery wallet becomes allowed to withdraw.',
        helpUrl: 'https://www.epochconverter.com/',
      },
    ],
    placeholderArgs: [
      byteArrayArg([
        170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
        184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
        198, 199, 200, 201,
      ]),
      byteArrayArg([
        187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177, 176, 175, 174,
        173, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161, 160,
        159, 158, 157, 156,
      ]),
      intArg(1000000000000),
    ],
  },
  {
    id: 'multi-sig-vault',
    name: '2-of-3 MultiSig Vault',
    description:
      'Protect funds with three signers. Any two signers can approve a withdrawal.',
    icon: '🔑',
    assetPath: 'assets/covenant-templates/multi-sig-vault.json',
    fields: [
      {
        paramName: 'key1',
        label: 'Your signer wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Your selected wallet. It is the first signer in the vault quorum.',
      },
      {
        paramName: 'key2',
        label: 'Second signer wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Second wallet allowed to sign. Any two of the three signers can spend.',
      },
      {
        paramName: 'key3',
        label: 'Third signer wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Third wallet allowed to sign. Any two of the three signers can spend.',
      },
    ],
    placeholderArgs: [
      byteArrayArg([
        204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217,
        218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
        232, 233, 234, 235,
      ]),
      byteArrayArg([
        221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234,
        235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248,
        249, 250, 251, 252,
      ]),
      byteArrayArg([
        238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251,
        252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
      ]),
    ],
  },
  {
    id: 'escrow-with-arbiter',
    name: 'Escrow with Arbiter',
    description:
      'Buyer and seller escrow with a trusted arbiter who can resolve disputes.',
    icon: '🤝',
    assetPath: 'assets/covenant-templates/escrow-with-arbiter.json',
    fields: [
      {
        paramName: 'buyer',
        label: 'Buyer wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Your selected wallet. The buyer can approve release or refund after expiry.',
      },
      {
        paramName: 'seller',
        label: 'Seller wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Seller wallet that receives funds when both sides release.',
      },
      {
        paramName: 'arbiterHash',
        label: 'Arbiter',
        type: 'hash32',
        placeholder: '0x...',
        description:
          'Trusted third party for disputes. Paste an address, public key, or 32-byte hash.',
      },
      {
        paramName: 'expiry',
        label: 'Refund available after',
        type: 'int_timestamp',
        placeholder: '',
        description:
          'Date and time when the buyer refund path becomes available.',
        helpUrl: 'https://www.epochconverter.com/',
      },
    ],
    placeholderArgs: [
      byteArrayArg([
        170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
        184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
        198, 199, 200, 201,
      ]),
      byteArrayArg([
        187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200,
        201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214,
        215, 216, 217, 218,
      ]),
      byteArrayArg([
        204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217,
        218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
        232, 233, 234, 235,
      ]),
      intArg(1000000000000),
    ],
  },
  {
    id: 'dead-mans-switch',
    name: "Dead Man's Switch",
    description:
      'Inheritance-style covenant. Your wallet refreshes the deadline; the heir can claim if it expires.',
    icon: '⏳',
    assetPath: 'assets/covenant-templates/dead-mans-switch.json',
    fields: [
      {
        paramName: 'owner',
        label: 'Owner wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Your selected wallet. It must refresh the deadline before the heir can claim.',
      },
      {
        paramName: 'heir',
        label: 'Heir wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Beneficiary wallet that can claim all funds if the owner misses the deadline.',
      },
      {
        paramName: 'expiry',
        label: 'Check-in deadline',
        type: 'int_timestamp',
        placeholder: '2026-12-31T23:59',
        description:
          'Absolute deadline. The heir can claim after this time unless the owner extends it with keepAlive.',
      },
    ],
    placeholderArgs: [
      byteArrayArg([
        170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
        184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
        198, 199, 200, 201,
      ]),
      byteArrayArg([
        204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217,
        218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
        232, 233, 234, 235,
      ]),
      intArg(1000000000000),
    ],
  },
];
