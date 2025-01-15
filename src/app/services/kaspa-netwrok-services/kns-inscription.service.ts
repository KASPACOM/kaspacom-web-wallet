import {
  IUtxoEntry,
  Opcodes,
  XOnlyPublicKey,
  ScriptBuilder,
  type HexString,
} from '../../../../public/kaspa/kaspa';

interface DomainInscriptionData {
  op: "create";
  p: "domain";
  v: string;  // domain name
  s?: "kas";  // suffix (optional, defaults to .kas)
}

interface InscriptionDataInterface extends DomainInscriptionData {}

export interface DomainVerificationResult {
  success: boolean;
  data?: {
    id: string;
    asset: string;
    owner: string;
  };
  message?: string;
  errorCode?: 'SERVER_ERROR' | 'CLIENT_ERROR' | 'API_ERROR' | 'INVALID_RESPONSE' | 'OWNER_MISMATCH' | 'NETWORK_ERROR' | 'MAX_RETRIES_EXCEEDED';
}

interface TransactionData {
  entries: IUtxoEntry[];
  outputs: Array<{
    address: string;
    amount: number;
  }>;
  changeAddress: string;
  priorityFee: number;
  type: string;
  inscriptionProtocol: string;
  networkId: string;
}

interface DomainRegistrationRequest {
  domain: string;
  ownerAddress: string;
  publicKey: string;
  network: string;
  fee: number;
}

interface DomainRegistrationResponse {
  script: string;
  commitTx: any;
  revealTx: any;
}

interface CommitRevealResult {
  commitTxId: string;
  revealTxId: string;
}

export class KNSInscriptionService {
  // Helper to convert hex string → Uint8Array
  private hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error(`Invalid hex string length: ${hex.length}`);
    }
    const matches = hex.match(/.{1,2}/g);
    if (!matches) {
      throw new Error('Invalid hex string format');
    }
    return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
  }

  private toUint8Array(data: string): Uint8Array {
    return new TextEncoder().encode(data);
  }

  async createInscriptionScript(
    publicKey: XOnlyPublicKey,
    inscriptionData: InscriptionDataInterface,
    kasware: any
  ): Promise<{ script: string, p2shAddress: string }> {
    if (!kasware) {
      throw new Error('Kasware instance is required');
    }

    // Convert public key to proper format
    const publicKeyBytes = (publicKey as unknown as { toBytes: () => Uint8Array }).toBytes();
    if (!publicKeyBytes || publicKeyBytes.length !== 32) {
      throw new Error('Invalid public key format');
    }

    // Build the domain registration script
    const scriptBuilder = new ScriptBuilder()
      .addData(publicKeyBytes)
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(Buffer.from('kns'))
      .addI64(0n)
      .addData(Buffer.from(JSON.stringify(inscriptionData)))
      .addOp(Opcodes.OpEndIf);

    // Get the script in hex format
    const script = scriptBuilder.toString();
    
    // Validate script format
    if (!script || typeof script !== 'string') {
      throw new Error('Invalid script generated');
    }

    // Let Kasware generate the P2SH address
    try {
      const p2shAddress = await kasware.getScriptAddress(script);
      if (!p2shAddress) {
        throw new Error('Failed to generate P2SH address');
      }
      return { script, p2shAddress };
    } catch (error) {
      console.error('Script address generation failed:', error);
      throw new Error(`Script address generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  calculateFee(domainLength: number): bigint {
    const SOMPI = 100000000n;
    const feeSchedule = {
      1: 6n * SOMPI,
      2: 5n * SOMPI,
      3: 4n * SOMPI,
      4: 3n * SOMPI,
      5: 2n * SOMPI
    };
    return feeSchedule[domainLength as keyof typeof feeSchedule] || 2n * SOMPI;
  }

  async createDomainInscription(
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string,
    kasware: any
  ): Promise<{
    script: string;
    commitData: any;
    revealData: any;
    networkId: string;
  }> {
    if (domain.length < 1 || domain.length > 5) {
      throw new Error('Domain length must be between 1 and 5 characters');
    }

    // Create domain inscription data
    const inscriptionData: DomainInscriptionData = {
      op: "create",
      p: "domain",
      v: domain,
      s: "kas"
    };

    // Generate the inscription script
    const { script, p2shAddress } = await this.createInscriptionScript(publicKey, inscriptionData, kasware);
    
    // Calculate domain registration fee
    const fee = this.calculateFee(domain.length);

    // KNS receiving address for testnet-10
    const knsReceivingAddress = 'kaspatest:qq9h47etjv6x8jgcla0ecnp8mgrkfxm70ch3k60es5a50ypsf4h6sak3g0lru';

    // Determine network ID
    let networkId = 'testnet-10';
    switch (network) {
      case 'kaspa_mainnet':
        networkId = 'mainnet';
        break;
      case 'kaspa_testnet_11':
        networkId = 'testnet-11';
        break;
      case 'kaspa_testnet_10':
        networkId = 'testnet-10';
        break;
      case 'kaspa_devnet':
        networkId = 'devnet';
        break;
    }

    // Commit transaction data
    const commitData = {
      entries,
      outputs: [{
        address,
        amount: 100000000 // 1 KAS
      }],
      changeAddress: address,
      priorityFee: 0.01,
      type: 'commit',
      inscriptionProtocol: 'domain',
      networkId
    };

    // Reveal transaction data
    const revealData = {
      outputs: [
        {
          address: knsReceivingAddress,
          amount: Number(fee) // Domain registration fee
        },
        {
          address, // Change output
          amount: 100000000 // 1 KAS
        }
      ],
      changeAddress: address,
      priorityFee: 0.02,
      type: 'reveal',
      inscriptionProtocol: 'domain',
      networkId
    };

    console.log('[KNS Domain Registration] Prepared domain inscription:', {
      domain,
      publicKey: publicKey.toString(),
      address,
      network,
      fee,
      commitData,
      revealData
    });

    return {
      script: script.toString(),
      commitData,
      revealData,
      networkId,
    };
  }

  public async verifyDomainOwnership(domain: string, ownerAddress: string): Promise<DomainVerificationResult> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`[KNS Domain Verification] Attempt ${attempt + 1} for domain: ${domain}`);
        
        const response = await fetch(`https://api.knsdomains.org/tn10/api/v1/${domain}/owner`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        // Handle server errors with retry
        if (response.status >= 500) {
          console.warn(`[KNS Domain Verification] Server error (${response.status}) - Retrying...`);
          attempt++;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          return { 
            success: false, 
            message: `Server error: ${response.statusText} (${response.status})`,
            errorCode: 'SERVER_ERROR'
          };
        }

        // Handle client errors without retry
        if (!response.ok) {
          console.error(`[KNS Domain Verification] Client error (${response.status}): ${response.statusText}`);
          return { 
            success: false, 
            message: `Request failed: ${response.statusText} (${response.status})`,
            errorCode: 'CLIENT_ERROR'
          };
        }

        const data = await response.json();
        
        if (!data.success) {
          console.error('[KNS Domain Verification] API returned unsuccessful response:', data.message);
          return { 
            success: false, 
            message: data.message,
            errorCode: data.errorCode || 'API_ERROR'
          };
        }
        
        if (!data.data?.owner) {
          console.error('[KNS Domain Verification] Missing owner data in response');
          return { 
            success: false, 
            message: 'Invalid response format - missing owner data',
            errorCode: 'INVALID_RESPONSE'
          };
        }

        if (data.data.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
          console.error('[KNS Domain Verification] Address mismatch:', {
            expected: ownerAddress.toLowerCase(),
            actual: data.data.owner.toLowerCase()
          });
          return { 
            success: false, 
            message: 'Address does not match domain owner',
            errorCode: 'OWNER_MISMATCH'
          };
        }
        
        console.log('[KNS Domain Verification] Successfully verified domain ownership');
        return { 
          success: true, 
          data: data.data 
        };
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error('[KNS Domain Verification] Failed after retries:', error);
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'NETWORK_ERROR'
          };
        }
        console.warn(`[KNS Domain Verification] Retrying after error (attempt ${attempt}):`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    return { 
      success: false, 
      message: 'Domain verification failed after maximum retries',
      errorCode: 'MAX_RETRIES_EXCEEDED'
    };
  }

  private convertFee(fee: bigint): number {
    if (fee > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Fee amount exceeds safe integer limits');
    }
    return Number(fee);
  }

  async prepareDomainRegistration(
    domain: string,
    publicKey: XOnlyPublicKey,
    ownerAddress: string,
    network: string
  ): Promise<DomainRegistrationRequest> {
    const fee = this.calculateFee(domain.length);
    return {
      domain,
      ownerAddress,
      publicKey: publicKey.toString(),
      network,
      fee: this.convertFee(fee)
    };
  }

  async processBackendResponse(response: DomainRegistrationResponse): Promise<{
    script: string;
    commitData: any;
    revealData: any;
  }> {
    return {
      script: response.script,
      commitData: response.commitTx,
      revealData: response.revealTx
    };
  }

  async registerDomain(
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string,
    kasware: any
  ): Promise<CommitRevealResult> {
    try {
      console.log('[KNS Register Domain] Starting Domain Registration');
      console.log('Domain:', domain);
      console.log('Public Key:', publicKey.toString());
      console.log('Network:', network);
      console.log('Address:', address);
      console.log('UTXO Entries:', entries);

      // Verify domain ownership
      const verification = await this.verifyDomainOwnership(domain, address);
      if (!verification.success) {
        throw new Error(`Domain verification failed: ${verification.message}`);
      }

      // Prepare registration request
      const registrationRequest = await this.prepareDomainRegistration(
        domain,
        publicKey,
        address,
        network
      );

      // Create domain inscription
      const { script, commitData, revealData, networkId } = 
        await this.createDomainInscription(domain, publicKey, entries, address, network, kasware);

      console.log('[KNS Register Domain] Commit-Reveal Details');
      console.log('Domain:', domain);
      console.log('Public Key:', publicKey.toString());
      console.log('Network:', network);
      console.log('Address:', address);
      console.log('UTXO Entries:', entries);

      // Submit transactions via Kasware
      console.log('[KNS Register Domain] Submitting transactions via Kasware');
      const result = await kasware.submitCommitReveal(
        commitData,
        revealData,
        script,
        networkId,
        "Commit & Reveal"
      );

      // Handle insufficient balance error
      if (!result.commitTxId || !result.revealTxId) {
        throw new Error('Transaction submission failed - missing transaction IDs');
      }

      // Verify transaction status
      const commitStatus = await kasware.getTransactionStatus(result.commitTxId);
      const revealStatus = await kasware.getTransactionStatus(result.revealTxId);
      
      if (!commitStatus.confirmed || !revealStatus.confirmed) {
        throw new Error('Transactions failed to confirm');
      }

      console.log('[KNS Register Domain] Transactions submitted successfully');
      console.log('Commit TX ID:', result.commitTxId);
      console.log('Reveal TX ID:', result.revealTxId);

      return result;
    } catch (error) {
      console.error('[KNS Register Domain] Error during domain registration:', error);
      throw new Error(`Domain registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    initialDelay: number,
    maxRetries: number
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}

export const knsInscriptionService = new KNSInscriptionService();
