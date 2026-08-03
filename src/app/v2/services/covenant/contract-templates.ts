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
  type:
    | 'address'
    | 'address_list'
    | 'int_days'
    | 'int_hours'
    | 'int_daa_delay'
    | 'int_timestamp'
    | 'int_count'
    | 'int_hidden'
    | 'whitelist_count'
    | 'hash32';
  placeholder: string;
  description: string;
  hidden?: boolean;
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

const pubkeyArrayArg = (pubkeys: number[][]): CtorArg => ({
  kind: 'array',
  data: pubkeys.map((bytes) => byteArrayArg(bytes)),
});

const selfCustodyWhitelistPlaceholderPubkeys = Array.from(
  { length: 10 },
  (_slot, slotIndex) => new Array<number>(32).fill(128 + slotIndex),
);

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'self-custody-vault',
    name: 'Self-Custody Vault',
    description:
      'Protect funds with a hot key, cold key, delayed unvaulting, and an optional destination whitelist.',
    icon: 'SCV',
    assetPath: 'assets/covenant-templates/self-custody-vault.json',
    fields: [
      {
        paramName: 'hotKey',
        label: 'Hot wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Your selected wallet. It can start unvaulting and finalize after the delay.',
      },
      {
        paramName: 'coldKey',
        label: 'Cold wallet',
        type: 'address',
        placeholder: 'kaspatest:q...',
        description:
          'Recovery wallet that can sweep immediately in an emergency.',
      },
      {
        paramName: 'whitelistedDestinations',
        label: 'Destination whitelist',
        type: 'address_list',
        placeholder: 'kaspatest:q...',
        description:
          'Optional list of recipient wallets. Choose send anywhere or restrict withdrawals to this list.',
      },
      {
        paramName: 'initUnvaultDelaySeconds',
        label: 'Unvault delay (DAA)',
        type: 'int_daa_delay',
        placeholder: '864000',
        description:
          'How many DAA score units the hot wallet must wait after unvaulting before finalizing.',
      },
      {
        paramName: 'initPhase',
        label: 'Initial phase',
        type: 'int_hidden',
        placeholder: '',
        description: 'Internal initial locked phase.',
        hidden: true,
      },
    ],
    placeholderArgs: [
      byteArrayArg([
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
        34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
      ]),
      byteArrayArg([
        80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
        98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
      ]),
      pubkeyArrayArg(selfCustodyWhitelistPlaceholderPubkeys),
      intArg(86400),
      intArg(0),
    ],
  },
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
