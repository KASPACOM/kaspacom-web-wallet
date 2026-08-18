import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  KcInputComponent,
  KcNumberInputComponent,
  KcStepperComponent,
} from '@kaspacom/ui-kit';
import { ERROR_CODES_MESSAGES } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../../../services/wallet-action.service';
import { QrScannerService } from '../../../../../../../services/qr-scanner.service';
import { UtilsHelper } from '../../../../../../../services/utils.service';
import { CovenantService } from '../../../../../../../services/covenant/covenant.service';
import { CovenantIndexerService } from '../../../../../../../services/covenant/covenant-indexer.service';
import {
  ContractRegistryEntry,
  ContractRegistryService,
} from '../../../../../../../services/covenant/contract-registry.service';
import { KaspaL1NetworkService } from '../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { TemplatePatcherService } from '../../../../../../services/covenant/template-patcher.service';
import {
  CONTRACT_TEMPLATES,
  ContractTemplate,
  TemplateField,
} from '../../../../../../services/covenant/contract-templates';
import { CompiledContract } from '../../../../../../../services/covenant/covenant-sdk/types';
import { CovenantDeployActionResult } from '../../../../../../../types/wallet-action-result';
import { WalletActionType } from '../../../../../../../types/wallet-action';
import { CopyButtonComponent } from '../../../../../../shared/ui/copy-button/copy-button.component';
import { AddressSmartInputComponent } from '../../../../../../shared/ui/input/address-smart-input/address-smart-input.component';
import { CovenantDateTimeInputComponent } from '../../covenant-date-time-input.component';
import { ContractDisplayService } from '../../services/contract-display.service';
import { CovenantTemplateService } from '../../services/covenant-template.service';
import { ContractsRegistryRefreshService } from '../../services/contracts-registry-refresh.service';
import { hex32ToBytes, computeBlake2bHex } from '../../crypto.util';
import {
  DeployIndexerState,
  SELF_CUSTODY_WHITELIST_CAPACITY,
} from '../../contracts-page.models';

/**
 * Emitted after a deploy submission succeeds, so the shell (which owns the
 * local contract registry) can record it. The shell calls `resolve(...)`
 * with the outcome so this component can drive its own deployIndexerState /
 * deployResult afterward — registryEntryId is needed to backfill the
 * covenant ID once the indexer confirms the deploy.
 */
@Component({
  selector: 'app-contract-template-deploy-form',
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcNumberInputComponent,
    KcStepperComponent,
    CopyButtonComponent,
    AddressSmartInputComponent,
    CovenantDateTimeInputComponent,
  ],
  templateUrl: './contract-template-deploy-form.component.html',
  styleUrl: './contract-template-deploy-form.component.scss',
})
export class ContractTemplateDeployFormComponent {
  readonly MIN_DEPLOY_AMOUNT_KAS = 0.5;
  readonly selfCustodyWhitelistCapacity = SELF_CUSTODY_WHITELIST_CAPACITY;

  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);
  private qrScannerService = inject(QrScannerService);
  private utilsHelper = inject(UtilsHelper);
  private covenantService = inject(CovenantService);
  private covenantIndexerService = inject(CovenantIndexerService);
  private registryService = inject(ContractRegistryService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);
  private templatePatcher = inject(TemplatePatcherService);
  display = inject(ContractDisplayService);
  private templateService = inject(CovenantTemplateService);
  private contractsRegistryRefresh = inject(ContractsRegistryRefreshService);

  constructor() {
    // Keep wallet-owned fields (e.g. hotKey) and the deploy-amount validity
    // in sync whenever the active wallet changes.
    effect(() => {
      this.currentWallet();
      this.syncWalletOwnedTemplateFields();
      this.validateDeployAmount(false);
    });
  }

  contractTemplates = CONTRACT_TEMPLATES;

  currentWallet = computed(() => this.walletService.getCurrentWallet());
  selectedAccount = computed(() => this.currentWallet() || undefined);

  selectedPubkey = computed(() => {
    const wallet = this.selectedAccount();
    if (!wallet) return '';
    return wallet.getPrivateKey().toPublicKey().toXOnlyPublicKey().toString();
  });

  deployAvailableBalance = computed(() => {
    const currentWallet = this.currentWallet();
    if (!currentWallet) return 0;
    const mature =
      currentWallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;
    return Number(mature) / 1e8;
  });

  networkBlocksPerSecond = computed(
    () => this.kaspaL1NetworkService.getCurrentNetwork().blocksPerSecond || 10,
  );
  network = computed(() => this.kaspaL1NetworkService.getNetworkId());

  activeTemplate = signal<ContractTemplate | null>(null);
  deploySteps = computed<{ label: string; value: number }[]>(() => {
    const pastChooseType = this.activeTemplate() !== null;

    return [
      { label: 'Choose type', value: pastChooseType ? 100 : 0 },
      {
        label: 'Set details',
        value: !pastChooseType ? 0 : this.isDeploying() ? 100 : 50,
      },
      { label: 'Review & deploy', value: this.isDeploying() ? 50 : 0 },
    ];
  });
  templateFormValues: { [paramName: string]: string } = {};
  templateFieldTouched: { [paramName: string]: boolean } = {};
  templateFieldErrors: { [paramName: string]: string } = {};
  templateResolvedAddresses: { [paramName: string]: string } = {};
  generatedContractJson = signal<string | null>(null);
  templateError = signal<string | null>(null);

  deployContractJson = signal('');
  deployAmount = '';
  deployContractNickname = '';
  deployAmountTouched = false;
  deployAmountError = signal('');
  deployResult = signal<{
    address: string;
    txid: string;
    covenantId?: string;
  } | null>(null);
  deployIndexerState = signal<DeployIndexerState | null>(null);
  deployError = signal<string | null>(null);
  isDeploying = signal(false);

  getTemplateKey(
    input: any,
  ):
    'deadman' | 'timelock' | 'multisig' | 'escrow' | 'selfcustody' | 'default' {
    return this.display.getTemplateKey(input);
  }

  selectTemplate(template: ContractTemplate) {
    const form = this.initializeTemplateForm(template);
    this.templateFormValues = form.values;
    this.templateFieldTouched = form.touched;
    this.templateFieldErrors = form.errors;
    this.templateResolvedAddresses = form.resolved;
    this.generatedContractJson.set(null);
    this.templateError.set(null);

    this.activeTemplate.set(template);
    this.syncWalletOwnedTemplateFields();
    this.applyTemplateDefaults(template);
  }

  private initializeTemplateForm(template: ContractTemplate): {
    values: Record<string, string>;
    touched: Record<string, boolean>;
    errors: Record<string, string>;
    resolved: Record<string, string>;
  } {
    const values: Record<string, string> = {};
    const touched: Record<string, boolean> = {};
    const errors: Record<string, string> = {};
    const resolved: Record<string, string> = {};
    const walletAddress =
      this.selectedAccount()?.getAddress() ||
      this.currentWallet()?.getAddress() ||
      '';

    for (const field of template.fields) {
      values[field.paramName] = this.isWalletOwnedField(field)
        ? walletAddress
        : '';
      touched[field.paramName] = false;
      errors[field.paramName] = '';
    }

    return { values, touched, errors, resolved };
  }

  private syncWalletOwnedTemplateFields() {
    const template = this.activeTemplate();
    const address =
      this.selectedAccount()?.getAddress() ||
      this.currentWallet()?.getAddress();
    if (!template || !address) return;

    let changed = false;
    const nextValues = { ...this.templateFormValues };

    for (const field of template.fields) {
      if (this.isWalletOwnedField(field)) {
        nextValues[field.paramName] = address;
        changed = true;
      }
    }

    if (changed) {
      this.templateFormValues = nextValues;
    }
  }

  private applyTemplateDefaults(template: ContractTemplate) {
    if (template.id !== 'self-custody-vault') return;
    this.templateFormValues['whitelistedDestinations_mode'] = 'anywhere';
    this.setSelfCustodyDelayFromHours(24, false);
  }

  resetTemplateSelection() {
    this.activeTemplate.set(null);
    this.generatedContractJson.set(null);
    this.templateError.set(null);
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);
    this.templateFieldTouched = {};
    this.templateFieldErrors = {};
    this.templateResolvedAddresses = {};
  }

  async generateContract() {
    const template = this.activeTemplate();
    if (!template) {
      this.templateError.set('Please select a template');
      return;
    }

    if (!this.validateAllTemplateFields(true)) {
      this.templateError.set(
        'Please complete the highlighted fields before deploying.',
      );
      return;
    }

    this.templateError.set(null);
    this.generatedContractJson.set(null);

    try {
      const fieldValues = this.getCurrentTemplateFieldValues(template);
      const newArgs = template.fields.map((field) =>
        this.templateService.fieldToCtorArgFromValues(field, fieldValues),
      );
      const { compiled, descriptor } =
        await this.templateService.getTemplatePatchContext(template.id);
      const patched = this.templatePatcher.applyPatch(
        compiled,
        descriptor,
        newArgs,
      );

      let argsPayload: any[] = [];
      let tmplName = compiled.contract_name;

      if (template.id === 'multi-sig-vault') {
        tmplName = 'MultiSigVault';
        argsPayload = [
          {
            name: 'signer1',
            type: 'address',
            value: this.getTemplateValueByName('key1'),
          },
          {
            name: 'signer2',
            type: 'address',
            value: this.getTemplateValueByName('key2'),
          },
          {
            name: 'signer3',
            type: 'address',
            value: this.getTemplateValueByName('key3'),
          },
        ];
      } else if (template.id === 'escrow-with-arbiter') {
        tmplName = 'EscrowWithArbiter';
        argsPayload = [
          {
            name: 'buyer',
            type: 'address',
            value: this.getTemplateValueByName('buyer'),
          },
          {
            name: 'seller',
            type: 'address',
            value: this.getTemplateValueByName('seller'),
          },
          {
            name: 'arbiter',
            type: 'address',
            value: this.templateFormValues['arbiterHash'],
          },
          {
            name: 'timeoutBlueScore',
            type: 'blueScore',
            value: String(
              this.templateService.parseDateToUnixMs(
                String(this.templateFormValues['expiry'] ?? '').trim(),
                'Refund Expiry Timestamp',
              ),
            ),
          },
        ];
      } else if (template.id === 'dead-mans-switch') {
        tmplName = 'DeadManSwitch';
        argsPayload = [
          {
            name: 'owner',
            type: 'address',
            value: this.getTemplateValueByName('owner'),
          },
          {
            name: 'heir',
            type: 'address',
            value: this.getTemplateValueByName('heir'),
          },
          {
            name: 'checkInDeadline',
            type: 'blueScore',
            value: String(
              this.templateService.parseDateToUnixMs(
                String(this.templateFormValues['expiry'] ?? '').trim(),
                'Check-in Deadline',
              ),
            ),
          },
        ];
      } else if (template.id === 'time-lock-vault') {
        tmplName = 'TimeLockVault';
        argsPayload = [
          {
            name: 'signer',
            type: 'address',
            value: this.getTemplateValueByName('owner'),
          },
          {
            name: 'recoveryKey',
            type: 'address',
            value: this.getTemplateValueByName('recovery'),
          },
          {
            name: 'unlockBlueScore',
            type: 'blueScore',
            value: String(
              this.templateService.parseDateToUnixMs(
                String(this.templateFormValues['timeout'] ?? '').trim(),
                'Unlock Timestamp',
              ),
            ),
          },
        ];
      } else if (template.id === 'self-custody-vault') {
        tmplName = 'SelfCustodyVault';
        argsPayload =
          this.templateService.buildSelfCustodyArgsPayload(fieldValues);
      }

      if (argsPayload.length > 0) {
        patched.tn10 = {
          v: 1,
          tmpl: tmplName,
          args: argsPayload,
        };
      }

      if (template.id === 'self-custody-vault') {
        this.templateService.logSelfCustodyContractParams('template creation', {
          fieldValues,
          constructorArgs: newArgs,
          tn10: patched.tn10,
          scriptLength: patched.script?.length,
          address: this.covenantService.getContractAddress(patched),
        });
      }

      this.generatedContractJson.set(JSON.stringify(patched, null, 2));
    } catch (error: any) {
      this.templateError.set(
        error?.message || 'Failed to generate contract from template',
      );
    }
  }

  async deployTemplateContract() {
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);
    this.templateError.set(null);

    if (
      !this.validateAllTemplateFields(true) ||
      !this.validateDeployAmount(true)
    ) {
      this.templateError.set(
        'Please complete the highlighted fields before deploying.',
      );
      return;
    }

    try {
      await this.generateContract();
      const generated = this.generatedContractJson();
      if (!generated) {
        const message =
          this.templateError() || 'Failed to generate contract from template';
        this.deployError.set(message);
        return;
      }
      this.deployContractJson.set(generated);
      await this.deployContract();
    } catch (error: any) {
      const message =
        error?.message || 'Failed to prepare contract for deployment';
      this.templateError.set(message);
      this.deployError.set(message);
    }
  }

  isWalletOwnedField(field: TemplateField): boolean {
    return (
      field.type === 'address' &&
      ['owner', 'buyer', 'key1', 'hotKey'].includes(field.paramName)
    );
  }

  getFieldHelp(field: TemplateField): string {
    if (this.isWalletOwnedField(field)) {
      return 'This is set to your currently selected wallet so the covenant remains controlled from this account.';
    }

    const help: Record<string, string> = {
      recovery:
        'A backup wallet that can recover the funds after the unlock date.',
      key2: 'A second signer. Any two configured signers can authorize a withdrawal.',
      key3: 'A third signer. Any two configured signers can authorize a withdrawal.',
      seller:
        'The seller receives funds when the buyer and seller both approve release.',
      heir: 'The beneficiary who can claim the funds if the owner misses the deadline.',
      arbiterHash:
        'Paste the arbiter address or public key. The wallet stores the required blake2b-256 hash in the covenant.',
      coldKey:
        'Keep this wallet separate from the hot wallet. It can sweep funds immediately in an emergency.',
      whitelistedDestinations:
        'Choose send anywhere for no destination restriction, or allow only listed wallets for withdrawals.',
      unvaultDelaySeconds: `This is a DAA-score delay, not wall-clock seconds. The hours value is only an estimate using the current ${this.networkBlocksPerSecond()} BPS network rate. If Kaspa BPS changes later, recreate the vault or use a larger DAA delay because the on-chain contract stores only the DAA amount.`,
      timeout:
        'The earliest date when the recovery wallet can use the backup withdrawal path.',
      expiry:
        this.activeTemplate()?.id === 'dead-mans-switch'
          ? 'How many days the owner can be inactive before the heir can claim.'
          : 'The deadline used by this covenant. The wallet converts this date to the timestamp format required by Kaspa.',
    };

    return help[field.paramName] || field.description;
  }

  getTemplateStepNumber(): number {
    return this.activeTemplate() ? 2 : 1;
  }

  private getTemplateFieldValue(field: TemplateField): string {
    return (
      this.templateResolvedAddresses[field.paramName] ||
      this.templateFormValues[field.paramName] ||
      ''
    );
  }

  private getTemplateValueByName(paramName: string): string {
    return (
      this.templateResolvedAddresses[paramName] ||
      this.templateFormValues[paramName] ||
      ''
    );
  }

  private getCurrentTemplateFieldValues(
    template: ContractTemplate,
  ): Record<string, string> {
    const values: Record<string, string> = { ...this.templateFormValues };
    for (const field of template.fields) {
      values[field.paramName] = this.getTemplateFieldValue(field);
    }
    return values;
  }

  onDeployContractNicknameChange(value: unknown) {
    this.deployContractNickname =
      value === null || value === undefined ? '' : String(value);
  }

  onDeployAmountChange(value: any) {
    this.deployAmount =
      value === null || value === undefined ? '' : String(value);
    this.deployAmountTouched = true;
    this.validateDeployAmount(false);
  }

  onMaxDeployAmountClick() {
    if (this.isDeploying()) return;
    this.deployAmount = String(this.deployAvailableBalance());
    this.deployAmountTouched = true;
    this.validateDeployAmount(false);
  }

  validateDeployAmount(markTouched = false): boolean {
    if (markTouched) this.deployAmountTouched = true;

    const raw = String(this.deployAmount ?? '').trim();
    if (!raw) {
      this.deployAmountError.set(
        this.deployAmountTouched ? 'Amount is required' : '',
      );
      return false;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount)) {
      this.deployAmountError.set('Enter a valid amount');
      return false;
    }

    if (amount < this.MIN_DEPLOY_AMOUNT_KAS) {
      this.deployAmountError.set(
        `Minimum amount is ${this.MIN_DEPLOY_AMOUNT_KAS} KAS`,
      );
      return false;
    }

    if (amount > this.deployAvailableBalance()) {
      this.deployAmountError.set('Insufficient balance');
      return false;
    }

    this.deployAmountError.set('');
    return true;
  }

  onTemplateFieldChange(field: TemplateField, value: any) {
    this.templateFormValues[field.paramName] = value || '';
    this.templateFieldTouched[field.paramName] = true;
    if (field.type === 'hash32') {
      this.onHash32Input(field.paramName, value || '');
    }
    this.validateTemplateField(field);
    this.templateError.set(null);
  }

  getWhitelistMode(paramName: string): 'anywhere' | 'whitelist' {
    return this.templateFormValues[paramName + '_mode'] === 'whitelist'
      ? 'whitelist'
      : 'anywhere';
  }

  setWhitelistMode(field: TemplateField, mode: 'anywhere' | 'whitelist') {
    this.templateFormValues[field.paramName + '_mode'] = mode;
    if (mode === 'anywhere') {
      this.templateFormValues[field.paramName] = '';
    } else if (!this.templateFormValues[field.paramName]) {
      this.templateFormValues[field.paramName] = JSON.stringify(['']);
    }
    this.templateFieldTouched[field.paramName] = true;
    this.validateTemplateField(field);
    this.templateError.set(null);
  }

  getTemplateAddressList(paramName: string): string[] {
    const raw = String(this.templateFormValues[paramName] ?? '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value ?? '').trim())
          .filter(Boolean);
      }
    } catch {
      return raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean);
    }
    return [];
  }

  getTemplateAddressListRows(paramName: string): string[] {
    const raw = String(this.templateFormValues[paramName] ?? '').trim();
    if (!raw) return [''];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value ?? ''));
      }
    } catch {
      return raw.split(/\r?\n|,/).map((value) => value.trim());
    }
    return [''];
  }

  onWhitelistAddressChange(field: TemplateField, index: number, value: string) {
    const rows = this.getTemplateAddressListRows(field.paramName);
    rows[index] = value || '';
    this.templateFormValues[field.paramName] = JSON.stringify(rows);
    this.templateFieldTouched[field.paramName] = true;
    this.validateTemplateField(field);
    this.templateError.set(null);
  }

  addWhitelistAddress(field: TemplateField) {
    const rows = this.getTemplateAddressListRows(field.paramName);
    if (rows.length >= this.selfCustodyWhitelistCapacity) return;
    rows.push('');
    this.templateFormValues[field.paramName] = JSON.stringify(rows);
    this.templateFieldTouched[field.paramName] = true;
    this.validateTemplateField(field);
  }

  removeWhitelistAddress(field: TemplateField, index: number) {
    const rows = this.getTemplateAddressListRows(field.paramName);
    rows.splice(index, 1);
    this.templateFormValues[field.paramName] = JSON.stringify(
      rows.length > 0 ? rows : [''],
    );
    this.templateFieldTouched[field.paramName] = true;
    this.validateTemplateField(field);
  }

  onTemplateAddressResolved(field: TemplateField, result: any) {
    if (result?.effectiveAddress) {
      this.templateResolvedAddresses[field.paramName] = result.effectiveAddress;
      this.templateFieldErrors[field.paramName] = '';
    } else {
      delete this.templateResolvedAddresses[field.paramName];
      this.validateTemplateField(field);
    }
  }

  onTemplateAddressQrClick(field: TemplateField) {
    if (this.qrScannerService.isCurrentlyScanning()) {
      this.qrScannerService.stopScanning();
      return;
    }

    this.qrScannerService.startScanning({
      scannerId: `qr-scanner-covenant-${field.paramName}`,
      title: `Scan ${field.label}`,
      onSuccess: (address: string) =>
        this.onTemplateFieldChange(field, address),
      onError: (error: string) =>
        console.error('[Contracts] QR scanning error:', error),
    });
  }

  validateAllTemplateFields(markTouched = false): boolean {
    const template = this.activeTemplate();
    if (!template) return false;

    let valid = true;
    for (const field of template.fields) {
      if (markTouched) this.templateFieldTouched[field.paramName] = true;
      valid = this.validateTemplateField(field) && valid;
    }
    return valid;
  }

  validateTemplateField(field: TemplateField): boolean {
    if (field.hidden) {
      this.templateFieldErrors[field.paramName] = '';
      return true;
    }

    if (this.isWalletOwnedField(field)) {
      this.syncWalletOwnedTemplateFields();
    }

    const value = String(this.templateFormValues[field.paramName] ?? '').trim();
    let error = '';

    if (!value) {
      if (
        field.type === 'address_list' &&
        this.getWhitelistMode(field.paramName) === 'anywhere'
      ) {
        error = '';
      } else {
        error = `${field.label} is required`;
      }
    } else if (field.type === 'address') {
      const resolvedAddress = this.templateResolvedAddresses[field.paramName];
      if (!this.utilsHelper.isValidWalletAddress(value) && !resolvedAddress) {
        error = 'Invalid wallet address';
      }
    } else if (field.type === 'address_list') {
      const addresses = this.getTemplateAddressList(field.paramName);
      if (this.getWhitelistMode(field.paramName) === 'whitelist') {
        if (addresses.length === 0) {
          error = 'Add at least one whitelist address';
        } else if (addresses.length > this.selfCustodyWhitelistCapacity) {
          error = `Maximum ${this.selfCustodyWhitelistCapacity} whitelist addresses`;
        } else if (
          addresses.some(
            (address) => !this.utilsHelper.isValidWalletAddress(address),
          )
        ) {
          error = 'Every whitelist entry must be a valid wallet address';
        }
      }
    } else if (field.type === 'hash32') {
      const normalized = value.replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
        error = 'Enter a Kaspa address, public key, or 32-byte hex hash';
      }
    } else if (field.type === 'int_timestamp') {
      if (!Number.isFinite(new Date(value).getTime())) {
        error = 'Select a valid date and time';
      }
    } else if (
      field.type === 'int_days' ||
      field.type === 'int_hours' ||
      field.type === 'int_daa_delay' ||
      field.type === 'int_count'
    ) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        error = 'Enter a non-negative number';
      } else if (field.type === 'int_daa_delay' && numeric > 0xffffff) {
        error = 'Maximum is 16,777,215 DAA score units';
      } else if (
        (field.type === 'int_days' ||
          field.type === 'int_daa_delay' ||
          field.type === 'int_count') &&
        !Number.isInteger(numeric)
      ) {
        error = 'Enter a non-negative whole number';
      }
    }

    this.templateFieldErrors[field.paramName] = error;
    return !error;
  }

  getTemplateFieldError(field: TemplateField): string {
    return this.templateFieldTouched[field.paramName]
      ? this.templateFieldErrors[field.paramName] || ''
      : '';
  }

  isTemplateFieldValid(field: TemplateField): boolean {
    return !this.getTemplateFieldError(field);
  }

  isCreateDeployDisabled(): boolean {
    if (this.isDeploying() || !this.currentWallet()) return true;
    if (!this.isDeployAmountCompleteValid()) return true;

    const template = this.activeTemplate();
    if (!template) return true;

    return template.fields.some((field) => {
      if (field.hidden) return false;
      if (
        field.type === 'address_list' &&
        this.getWhitelistMode(field.paramName) === 'anywhere'
      ) {
        return !!this.templateFieldErrors[field.paramName];
      }
      const value = String(
        this.templateFormValues[field.paramName] ?? '',
      ).trim();
      return !value || !!this.templateFieldErrors[field.paramName];
    });
  }

  private isDeployAmountCompleteValid(): boolean {
    const raw = String(this.deployAmount ?? '').trim();
    if (!raw) return false;
    const amount = Number(raw);
    return (
      Number.isFinite(amount) &&
      amount >= this.MIN_DEPLOY_AMOUNT_KAS &&
      amount <= this.deployAvailableBalance()
    );
  }

  /**
   * Handle hash32 field input — if user pastes a 32-byte pubkey (64 hex chars),
   * auto-compute blake2b-256 hash and replace the field value.
   * If user pastes a 64-char hex string that looks like it could already be a hash,
   * we keep it as-is (could be either pubkey or hash — user decides).
   */
  onHash32Input(paramName: string, value: string) {
    const normalized = (value || '').trim().replace(/^0x/i, '');
    this.templateFormValues[paramName + '_isAutoHashed'] = '';

    if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
      return;
    }

    if (normalized.startsWith('kaspa') || normalized.startsWith('kaspatest')) {
      try {
        const pubkeyBytes = this.templatePatcher.kaspaAddressToPubkeyBytes(
          value.trim(),
        );
        const hashHex = computeBlake2bHex(pubkeyBytes);
        this.templateFormValues[paramName] = hashHex;
        this.templateFormValues[paramName + '_isAutoHashed'] = 'true';
      } catch {
        // Invalid address — let validation catch it
      }
    }
  }

  /**
   * Compute blake2b-256 hash of a hex value and update the field
   */
  computeBlake2bHash(paramName: string) {
    const value = (this.templateFormValues[paramName] || '')
      .trim()
      .replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(value)) return;

    this.templateFormValues[paramName] = computeBlake2bHex(hex32ToBytes(value));
    this.templateFormValues[paramName + '_isAutoHashed'] = 'true';
  }

  selfCustodyDelayHoursValue(paramName: string): string {
    const daaScore = Number(this.templateFormValues[paramName] ?? '');
    if (!Number.isFinite(daaScore)) return '';
    const hours = this.templateService.daaDelayToHours(daaScore);
    return Number.isInteger(hours)
      ? String(hours)
      : String(Number(hours.toFixed(6)));
  }

  onSelfCustodyDelayHoursChange(field: TemplateField, value: unknown): void {
    const rawValue = String(value ?? '').trim();
    const hours = Number(rawValue || '0');
    if (!Number.isFinite(hours) || hours < 0) {
      this.templateFormValues[field.paramName] = rawValue;
      this.templateFieldTouched[field.paramName] = true;
      this.validateTemplateField(field);
      return;
    }
    this.setSelfCustodyDelayFromHours(hours, true);
    this.validateTemplateField(field);
  }

  onSelfCustodyDelayDaaChange(field: TemplateField, value: unknown): void {
    this.onTemplateFieldChange(field, value);
  }

  private setSelfCustodyDelayFromHours(
    hours: number,
    markTouched: boolean,
  ): void {
    this.templateFormValues['unvaultDelaySeconds'] = String(
      this.templateService.hoursToDaaDelay(hours),
    );
    if (markTouched) {
      this.templateFieldTouched['unvaultDelaySeconds'] = true;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseAccessRoles(contract: CompiledContract): Array<{
    functionName: string;
    params: Array<{ name: string; type: string }>;
    description: string;
  }> {
    const roles: Array<{
      functionName: string;
      params: Array<{ name: string; type: string }>;
      description: string;
    }> = [];
    const constructorPubkeys = contract.ast.params
      .filter((p) => p.type_ref.base === 'pubkey')
      .map((p) => ({ name: p.name, type: 'pubkey' }));
    const entrypoints = contract.ast.functions.filter((f) => f.entrypoint);

    for (const fn of entrypoints) {
      const fnParams = fn.params.map((p) => ({
        name: p.name,
        type: p.type_ref.base,
      }));
      const pubkeyParams = constructorPubkeys.filter((p) =>
        fnParams.some((fp) => fp.type === 'pubkey' && fp.name === p.name),
      );

      let description = `Function "${fn.name}" can be called`;
      if (pubkeyParams.length > 0) {
        description += ` by ${pubkeyParams.map((p) => p.name).join(', ')}`;
      }

      roles.push({
        functionName: fn.name,
        params: fnParams,
        description,
      });
    }

    return roles;
  }

  private async saveDeployedContractToRegistry(input: {
    contractJson: string;
    compiled: CompiledContract;
    result: CovenantDeployActionResult;
    amountSompi: bigint;
    walletAddress: string;
    walletDisplayName: string;
    pubkey: string;
    walletKey?: string;
    nickname: string;
  }): Promise<{
    registryEntryId?: string;
    clearNickname?: boolean;
    saveError?: string;
  }> {
    const entry: ContractRegistryEntry = {
      id: this.registryService.generateId(),
      contractName: input.compiled.contract_name || 'Unnamed Contract',
      compiledJson: input.contractJson,
      deployTxid: input.result.txid,
      contractAddress: input.result.contractAddress,
      outpoint: input.result.outpoint,
      amountSompi: input.amountSompi.toString(),
      deployedBy: {
        address: input.walletAddress,
        pubkey: input.pubkey,
        accountName: input.walletDisplayName,
      },
      deployedAt: Date.now(),
      network: this.network(),
      status: 'active',
      accessRoles: this.parseAccessRoles(input.compiled),
      covenantId: input.result.covenantId,
      wallets: input.walletKey ? { [input.walletKey]: true } : undefined,
    };

    try {
      const alias = input.nickname.trim();
      if (alias && input.walletKey) {
        entry.aliases = { [input.walletKey]: alias };
      }

      await this.registryService.addContract(entry);
      this.contractsRegistryRefresh.notify('saved');

      return {
        registryEntryId: entry.id,
        clearNickname: !!alias && !!input.walletKey,
      };
    } catch (error) {
      console.error(
        '[Contracts][DeployForm] Contract deployed but failed to save to registry:',
        error,
      );
      return {
        saveError: `Contract deployed (txid ${input.result.txid}), but saving it locally failed. Record the outpoint to interact later: ${input.result.outpoint.txid}:${input.result.outpoint.vout}.`,
      };
    }
  }

  async deployContract() {
    this.deployError.set(null);
    this.deployResult.set(null);
    this.deployIndexerState.set(null);

    const wallet = this.selectedAccount();
    if (!wallet) {
      this.deployError.set('No wallet selected');
      return;
    }

    const contractJson = this.deployContractJson();
    const amountKas = Number(this.deployAmount);

    if (!contractJson) {
      this.deployError.set('Failed to generate contract from template');
      return;
    }

    if (!this.validateDeployAmount(true)) {
      return;
    }

    try {
      this.isDeploying.set(true);

      const compiled = this.covenantService.parseCompiledContract(contractJson);
      const amountSompi = BigInt(Math.floor(amountKas * 1e8));

      if (
        this.currentWallet()?.getIdWithAccount() !== wallet.getIdWithAccount()
      ) {
        this.walletService.selectCurrentWallet(wallet.getIdWithAccount());
      }

      const actionResult =
        await this.walletActionService.validateAndDoActionAfterApproval({
          type: WalletActionType.COVENANT_DEPLOY,
          data: {
            compiledContractJson: contractJson,
            contractName: compiled.contract_name || 'Covenant',
            amountSompi,
          },
        });

      if (!actionResult.success || !actionResult.result) {
        const reason =
          actionResult.errorCode !== undefined
            ? ERROR_CODES_MESSAGES[actionResult.errorCode]
            : undefined;
        this.deployError.set(
          reason
            ? `Covenant deployment failed: ${reason}`
            : 'Covenant deployment was rejected or failed',
        );
        return;
      }

      const result = actionResult.result as CovenantDeployActionResult;

      this.deployResult.set({
        address: result.contractAddress,
        txid: result.txid,
        covenantId: result.covenantId,
      });

      const outcome = await this.saveDeployedContractToRegistry({
        contractJson,
        compiled,
        result,
        amountSompi,
        walletAddress: wallet.getAddress(),
        walletDisplayName: wallet.getDisplayName(),
        pubkey: wallet
          .getPrivateKey()
          .toPublicKey()
          .toXOnlyPublicKey()
          .toString(),
        walletKey: wallet.getIdWithAccount(),
        nickname: this.deployContractNickname,
      });

      if (outcome.saveError) {
        this.deployError.set(outcome.saveError);
      } else if (outcome.clearNickname) {
        this.deployContractNickname = '';
      }
      void this.trackDeployIndexing(
        result.txid,
        outcome.registryEntryId,
        result.covenantId,
      );
    } catch (error: any) {
      console.error('[Deploy] Failed:', error);
      this.deployError.set(error?.message || 'Failed to deploy contract');
    } finally {
      this.isDeploying.set(false);
    }
  }

  private async trackDeployIndexing(
    txid: string,
    registryEntryId?: string,
    initialCovenantId?: string,
  ) {
    this.deployIndexerState.set({
      txid,
      status: 'checking',
      covenantId: initialCovenantId,
      message: 'Waiting for the indexer to see this deployment...',
    });

    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        const status =
          await this.covenantIndexerService.getTransactionSettlementStatus(
            txid,
          );
        const actions = status.actions || [];
        const indexedCovenantId =
          initialCovenantId ||
          actions.find((action) => action.covenantIdHex)?.covenantIdHex;

        if (status.indexed) {
          if (registryEntryId && indexedCovenantId) {
            await this.registryService.updateContract(registryEntryId, {
              covenantId: indexedCovenantId,
            });
            this.contractsRegistryRefresh.notify('indexed');
          }
          this.deployResult.update((current) =>
            current ? { ...current, covenantId: indexedCovenantId } : current,
          );
          this.deployIndexerState.set({
            txid,
            status: 'indexed',
            covenantId: indexedCovenantId,
            message: 'Indexed. This contract is now tracked from My Contracts.',
          });
          return;
        }

        this.deployIndexerState.set({
          txid,
          status: 'checking',
          covenantId: indexedCovenantId,
          message: `Waiting for indexer confirmation (${attempt}/8)...`,
        });
      } catch (error: any) {
        console.warn('[Contracts] Deploy indexing check failed:', error);
        this.deployIndexerState.set({
          txid,
          status: 'unavailable',
          covenantId: initialCovenantId,
          message:
            error?.message ||
            'Indexer status is unavailable. The deployment tx was still returned by the wallet.',
        });
        return;
      }

      await this.delay(2500);
    }

    this.deployIndexerState.set({
      txid,
      status: 'not-indexed',
      covenantId: initialCovenantId,
      message:
        'Deployment broadcasted, but the indexer has not confirmed it yet. Refresh My Contracts in a moment.',
    });
  }
}
