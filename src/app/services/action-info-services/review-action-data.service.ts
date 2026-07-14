import { Injectable, inject } from '@angular/core';
import {
  CommitRevealAction,
  CompoundUtxosAction,
  CovenantDeployAction,
  CovenantSpendAction,
  CovenantCompletePartialAction,
  SignPsktTransactionAction,
  TransferKasAction,
  WalletAction,
  WalletActionType,
} from '../../types/wallet-action';
import { KaspaNetworkActionsService } from '../kaspa-netwrok-services/kaspa-network-actions.service';
import { BaseProtocolClassesService } from '../protocols/base-protocol-classes.service';
import { AppWallet } from '../../classes/AppWallet';
import {
  ActionDisplay,
  ActionDisplayRow,
  InputFieldType,
} from '../../types/action-display.type';
import {
  SignMessageActionInterface,
  EIP1193RequestParams,
  EIP1193RequestType,
} from '@kaspacom/wallet-messages';
import { Transaction } from '../../../../public/kaspa/kaspa';
import { BaseCommunicationApp } from '../communication-service/communication-app/base-communication-app';
import { environment } from '../../../environments/environment';
import { formatUnits } from 'ethers';

@Injectable({
  providedIn: 'root',
})
export class ReviewActionDataService {
  private readonly kaspaNetworkActionsService = inject(
    KaspaNetworkActionsService,
  );
  private readonly baseProtocolClassesService = inject(
    BaseProtocolClassesService,
  );

  public getActionDisplay(
    action: WalletAction | undefined,
    wallet: AppWallet,
  ): ActionDisplay | undefined {
    if (!action) {
      return undefined;
    }

    switch (action?.type) {
      case WalletActionType.TRANSFER_KAS:
        return this.getTransferKasActionDisplay(action.data, wallet);
      case WalletActionType.COMPOUND_UTXOS:
        return this.getCompoundUtxosActionDisplay(action.data, wallet);
      case WalletActionType.COMMIT_REVEAL:
        return this.getCommitRevealActionDisplay(action.data, wallet);
      case WalletActionType.COVENANT_DEPLOY:
        return this.getCovenantDeployActionDisplay(action.data, wallet);
      case WalletActionType.COVENANT_SPEND:
        return this.getCovenantSpendActionDisplay(action.data, wallet);
      case WalletActionType.COVENANT_COMPLETE_PARTIAL:
        return this.getCovenantCompletePartialActionDisplay(action.data, wallet);
      case WalletActionType.SIGN_PSKT_TRANSACTION:
        return this.getSignPsktTransactionActionDisplay(action.data, wallet);
      case WalletActionType.SIGN_MESSAGE:
        return this.getSignMessageActionDisplay(action.data, wallet);
      case WalletActionType.EIP1193_PROVIDER_REQUEST:
        return this.getEip1193ActionDisplay(action.data, wallet);
      case WalletActionType.APPROVE_COMMUNICATION_APP:
        return this.getApproveCommunicationAppDisplay(action.data, wallet);
      default:
        return undefined;
    }
  }

  private getTransferKasActionDisplay(
    actionData: TransferKasAction,
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Transfer KAS',
      rows: [
        {
          fieldName: 'Sender',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Recipient',
          fieldValue: actionData.to,
        },
        {
          fieldName: 'Amount',
          fieldValue: this.kaspaNetworkActionsService
            .sompiToNumber(actionData.amount)
            .toString(),
        },
      ],
    };
  }

  private getCompoundUtxosActionDisplay(
    actionData: CompoundUtxosAction,
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Compound UTXOs',
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
      ],
    };
  }

  private getSignMessageActionDisplay(
    actionData: SignMessageActionInterface,
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Signature Request',
      subtitle:
        'This action is gas free and will not cost you anything, or give any permission to the requested entity.',
      rows: [
        {
          fieldName: 'Wallet Address',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Message',
          fieldValue: actionData.message,
          isCodeBlock: true,
        },
      ],
    };
  }

  private getCommitRevealActionDisplay(
    actionData: CommitRevealAction,
    wallet: AppWallet,
  ): ActionDisplay {
    if (actionData) {
      const reviewerClass = this.baseProtocolClassesService.getClassesFor(
        actionData.actionScript.type!,
      );

      if (reviewerClass?.actionsDataReviewer) {
        const result = reviewerClass.actionsDataReviewer.getActionDisplay(
          actionData,
          wallet,
        );

        if (result) {
          return result;
        }
      }
    }

    const result = {
      title: 'Do Protocol Action',
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Protocol',
          fieldValue: actionData.actionScript?.type || '-',
        },
        {
          fieldName: 'Action',
          fieldValue: actionData.actionScript?.stringifyAction || '-',
          isCodeBlock: true,
        },
      ],
    };

    if (actionData.options?.commitTransactionId) {
      result.rows.push({
        fieldName: 'Commit Transaction ID',
        fieldValue: actionData.options?.commitTransactionId,
      });
    }

    if (actionData.options?.additionalOutputs?.length) {
      result.rows.push({
        fieldName: 'Additional Payments Amount',
        fieldValue:
          actionData.options?.additionalOutputs
            ?.reduce(
              (sum, out) =>
                sum + this.kaspaNetworkActionsService.sompiToNumber(out.amount),
              0,
            )
            .toString() + ' KAS',
      });
      result.rows.push({
        fieldName: 'Additional Payments Details',
        fieldValue:
          actionData.options?.additionalOutputs
            ?.map(
              (out) =>
                `${out.address}: ${this.kaspaNetworkActionsService.sompiToNumber(out.amount)} KAS`,
            )
            .join('\n') || '-',
        isCodeBlock: true,
      });
    }

    return result;
  }

  private getCovenantDeployActionDisplay(
    actionData: CovenantDeployAction,
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Deploy Covenant Contract',
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Contract',
          fieldValue: actionData.contractName || 'Compiled covenant',
        },
        {
          fieldName: 'Amount Locked',
          fieldValue: this.kaspaNetworkActionsService.sompiToNumber(actionData.amountSompi) + ' KAS',
        },
      ],
    };
  }

  private getCovenantSpendActionDisplay(
    actionData: CovenantSpendAction,
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Interact With Covenant Contract',
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Contract',
          fieldValue: actionData.contractName || 'Compiled covenant',
        },
        {
          fieldName: 'Function',
          fieldValue: actionData.functionName,
        },
        {
          fieldName: 'Outpoint',
          fieldValue: actionData.outpoint.txid + ':' + actionData.outpoint.vout,
          isCodeBlock: true,
        },
        {
          fieldName: 'Outputs',
          fieldValue: actionData.outputs
            .map((output) => this.kaspaNetworkActionsService.sompiToNumber(output.amount) + ' KAS to ' + output.address)
            .join('\n') || '-',
          isCodeBlock: true,
        },
      ],
    };
  }

  private getCovenantCompletePartialActionDisplay(
    actionData: CovenantCompletePartialAction,
    wallet: AppWallet,
  ): ActionDisplay {
    let functionName = '-';
    let outpoint = '-';
    let outputsDisplay = '-';

    try {
      const partial = JSON.parse(actionData.partialSpendJson);
      functionName = partial.functionName || '-';
      outpoint = partial.outpoint
        ? partial.outpoint.txid + ':' + partial.outpoint.vout
        : '-';
      if (Array.isArray(partial.outputs) && partial.outputs.length) {
        outputsDisplay = partial.outputs
          .map(
            (o: { address: string; amountSompi: string }) =>
              `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(o.amountSompi))} KAS to ${o.address}`,
          )
          .join('\n');
      }
    } catch {
      // Validation will reject invalid JSON before execution.
    }

    return {
      title: 'Complete Covenant Interaction',
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Contract',
          fieldValue: actionData.contractName || 'Compiled covenant',
        },
        {
          fieldName: 'Function',
          fieldValue: functionName,
        },
        {
          fieldName: 'Outpoint',
          fieldValue: outpoint,
          isCodeBlock: true,
        },
        {
          fieldName: 'Outputs',
          fieldValue: outputsDisplay,
          isCodeBlock: true,
        },
      ],
    };
  }

  private getSignPsktTransactionActionDisplay(
    actionData: SignPsktTransactionAction,
    wallet: AppWallet,
  ): ActionDisplay {
    const transactionData = Transaction.deserializeFromSafeJSON(
      actionData.psktTransactionJson,
    );

    const inputsSum = transactionData.inputs.reduce(
      (sum, input) => sum + input.utxo!.amount,
      0n,
    );

    const outputsSum = transactionData.outputs.reduce(
      (sum, input) => sum + input.value,
      0n,
    );

    if (inputsSum > 0n && transactionData.outputs.length) {
      for (let i = 0; i < transactionData.outputs.length; i++) {
        if (
          transactionData.outputs[i].scriptPublicKey.script ===
          transactionData.inputs[0].utxo!.scriptPublicKey.script
        ) {
          if (transactionData.outputs[i].value - inputsSum < 0n) {
            const outputs = transactionData.outputs;
            outputs.splice(i, 1);

            transactionData.outputs = outputs;
          } else {
            transactionData.outputs[i].value =
              transactionData.outputs[i].value - inputsSum;
          }

          break;
        }
      }
    }

    const transactionFee = inputsSum - outputsSum;

    const feeRow =
      transactionFee > 0n
        ? [
            {
              fieldName: 'Transaction Fee',
              fieldValue:
                this.kaspaNetworkActionsService.sompiToNumber(transactionFee) +
                ' KAS',
            },
          ]
        : [];

    return {
      title: `Sign${actionData.submitTransaction ? ' & Submit' : ''} PSKT Transaction`,
      rows: [
        {
          fieldName: 'Wallet',
          fieldValue: wallet.getAddress(),
        },
        {
          fieldName: 'Payments',
          fieldValue: transactionData.outputs
            .map(
              (output) =>
                `${this.kaspaNetworkActionsService.sompiToNumber(output.value)} KAS to ${this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(output.scriptPublicKey)}`,
            )
            .join('\n'),
          isCodeBlock: true,
        },
        ...feeRow,
      ],
    };
  }

  private getEip1193ActionDisplay(
    actionData: any,
    wallet: AppWallet,
  ): ActionDisplay | undefined {
    const method = actionData.method;
    const params = actionData.params;

    switch (method) {
      case EIP1193RequestType.SEND_TRANSACTION:
        return this.getSendTransactionActionDisplay(params, wallet);
      case EIP1193RequestType.KAS_SEND_TRANSACTION:
        return this.getKasSendTransactionActionDisplay(params, wallet);
      case EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN:
        return this.getAddEthereumChainActionDisplay(params, wallet);
      case EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN:
        return this.getSwitchEthereumChainActionDisplay(params, wallet);
      case EIP1193RequestType.SIGN_TYPED_DATA:
        return this.getSignTypedDataActionDisplay(params, wallet);
      case EIP1193RequestType.SIGN_TYPED_DATA_V4:
        return this.getSignTypedDataV4ActionDisplay(params, wallet);
      default:
        return undefined;
    }
  }

  private getSendTransactionActionDisplay(
    params: EIP1193RequestParams[EIP1193RequestType.SEND_TRANSACTION],
    wallet: AppWallet,
  ): ActionDisplay {
    const tx = params[0];
    return {
      title: 'Send L2 Transaction',
      rows: [
        {
          fieldName: 'From',
          fieldValue: tx.from,
        },
        {
          fieldName: 'To',
          fieldValue: tx.to || 'Contract Creation',
        },
        {
          fieldName: 'Value',
          fieldValue: tx.value
            ? `${formatUnits(tx.value, wallet.getL2Provider()!.getConfig().nativeCurrency.decimals)} ${wallet.getL2Provider()!.getConfig().nativeCurrency.symbol}`
            : `0 ${wallet.getL2Provider()!.getConfig().nativeCurrency.symbol}`,
        },
        {
          fieldName: 'Data',
          fieldValue: tx.data || '',
          isCodeBlock: true,
        },
      ],
    };
  }

  private getKasSendTransactionActionDisplay(
    params: EIP1193RequestParams[EIP1193RequestType.KAS_SEND_TRANSACTION],
    wallet: AppWallet,
  ): ActionDisplay {
    const ethTransactionData = this.getSendTransactionActionDisplay(
      [params[0]],
      wallet,
    );

    let result = {
      title: 'Send L2 Transaction With Kaspa',
      rows: [...ethTransactionData.rows],
    };

    if (params[1] && params[1].outputs?.length) {
      result.rows.push({
        fieldName: 'Kaspa Payments',
        fieldValue:
          params[1]?.outputs
            ?.map(
              (output) =>
                `${this.kaspaNetworkActionsService.sompiToNumber(output.amount)} KAS to ${output.address}`,
            )
            .join('\n') || 'None',
        isCodeBlock: true,
      });
    }

    return result;
  }

  private getAddEthereumChainActionDisplay(
    params: any[],
    wallet: AppWallet,
  ): ActionDisplay {
    const chainData = params[0];
    return {
      title: 'Add L2 Chain',
      rows: [
        {
          fieldName: 'Chain ID',
          fieldValue: chainData.chainId,
        },
        {
          fieldName: 'Chain Name',
          fieldValue: chainData.chainName,
        },
        {
          fieldName: 'Native Currency',
          fieldValue: `${chainData.nativeCurrency.name} (${chainData.nativeCurrency.symbol})`,
        },
        {
          fieldName: 'RPC URLs',
          fieldValue: chainData.rpcUrls.join('\n'),
          isCodeBlock: true,
        },
        {
          fieldName: 'Block Explorer URLs',
          fieldValue: chainData.blockExplorerUrls?.join('\n') || 'None',
          isCodeBlock: true,
        },
      ],
    };
  }

  private getSwitchEthereumChainActionDisplay(
    params: any[],
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Switch L2 Chain',
      rows: [
        {
          fieldName: 'Chain ID',
          fieldValue: params[0].chainId,
        },
      ],
    };
  }

  private getSignTypedDataActionDisplay(
    params: any[],
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Sign L2 Typed Data',
      rows: [
        {
          fieldName: 'Address',
          fieldValue: params[0],
        },
        {
          fieldName: 'Typed Data',
          fieldValue: params[1],
          isCodeBlock: true,
        },
      ],
    };
  }

  private getSignTypedDataV4ActionDisplay(
    params: any[],
    wallet: AppWallet,
  ): ActionDisplay {
    return {
      title: 'Sign L2 Typed Data V4',
      rows: [
        {
          fieldName: 'Address',
          fieldValue: params[0],
        },
        {
          fieldName: 'Typed Data',
          fieldValue: params[1],
          isCodeBlock: true,
        },
      ],
    };
  }

  private getApproveCommunicationAppDisplay(
    app: BaseCommunicationApp,
    wallet: AppWallet,
  ): ActionDisplay {
    const l2AdressRow: ActionDisplayRow[] = [];

    if (wallet.getL2WalletStateSignal()()?.address) {
      l2AdressRow.push({
        fieldName: 'L2 Wallet Address',
        fieldValue: wallet.getL2WalletStateSignal()()!.address!,
      });
    }

    return {
      title: `${app.getName() || app.getApplicationId()} wants to connect to your wallet`,
      rows: [
        {
          fieldName: 'Application',
          fieldValue: app.getApplicationId(),
        },
        {
          fieldName: 'Wallet Address',
          fieldValue: wallet.getAddress(),
        },
        ...l2AdressRow,
        {
          fieldName: "Don't ask again for this application & wallet",
          fieldValue: 'false',
          inputField: {
            fieldType: InputFieldType.CHECKBOX,
            fieldParam: 'alwaysApprove',
          },
        },
      ],
    };
  }
}
