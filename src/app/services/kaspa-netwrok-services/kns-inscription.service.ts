import {
  IUtxoEntry,
  Opcodes,
  XOnlyPublicKey,
  ScriptBuilder,
  type HexString,
} from '../../../../public/kaspa/kaspa';

interface InscriptionDataInterface {
  op: string;
  p: string;
  v: string;
  s?: string;
}

interface DomainVerificationResult {
  success: boolean;
  data?: {
    id: string;
    asset: string;
    owner: string;
  };
  message?: string;
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
    // Optional: Basic validation
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

  createInscriptionScript(
    publicKey: XOnlyPublicKey,
    inscriptionData: InscriptionDataInterface
  ): ScriptBuilder {
    console.log('Creating script with X-only public key:', publicKey.toString());

    // Convert the XOnlyPublicKey (which is hex-encoded X coordinate) back into bytes
    const pubKeyHex = publicKey.toString(); // 64-hex-chars if truly x-only
    const pubKeyBytes = this.hexToBytes(pubKeyHex);

    console.log('X-only pubKeyBytes:', Array.from(pubKeyBytes));
    console.log('X-only pubKeyBytes length:', pubKeyBytes.length);

    // Build the inscription script with raw bytes for OP_CHECKSIG
    const script = new ScriptBuilder()
      .addData(pubKeyBytes)
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(this.toUint8Array('kns'))
      .addI64(0n)
      .addData(this.toUint8Array(JSON.stringify(inscriptionData, null, 0)))
      .addOp(Opcodes.OpEndIf);

    console.log('Final script:', script.toString());
    return script;
  }

  calculateFee(domainLength: number): number {
    // Convert KAS to Sompi (1 KAS = 100,000,000 Sompi)
    const kasToSompi = (kas: number) => kas * 100000000;
    
    if (domainLength === 1) return kasToSompi(6);
    if (domainLength === 2) return kasToSompi(5);
    if (domainLength === 3) return kasToSompi(4);
    if (domainLength === 4) return kasToSompi(3);
    return kasToSompi(2);
  }

  async createDomainInscription(
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string
  ): Promise<{
    script: string;
    commitData: any;
    revealData: any;
    networkId: string;
  }> {
    // Validate domain length (1-5 characters)
    if (domain.length < 1 || domain.length > 5) {
      throw new Error('Domain length must be between 1 and 5 characters');
    }

    // Format inscription data according to KNS spec
    const inscriptionData = {
      op: 'create',
      p: 'domain',
      v: domain
    };

    // Convert inscription data to compact JSON (no whitespace)
    const compactInscriptionData = JSON.stringify(inscriptionData, null, 0);
    console.log('Inscription Data:', compactInscriptionData);

    const script = this.createInscriptionScript(publicKey, inscriptionData);
    const fee = this.calculateFee(domain.length);
    console.log('Domain Length:', domain.length, 'Fee:', fee);

    // Hard-coded KNS receiving address for testnet 10
    const p2shAddress = 'kaspatest:qq9h47etjv6x8jgcla0ecnp8mgrkfxm70ch3k60es5a50ypsf4h6sak3g0lru';

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

    // Ensure amounts are numbers
    const commitAmount = 1; // 1 sompi for dust output
    const revealAmount = Number(fee);

    if (isNaN(revealAmount)) {
      throw new Error('Invalid fee amount');
    }

    // Structure the transactions according to Kasware's expected format
    // Increase dust amount and simplify output structure
    const commitData = {
      entries,
      outputs: [{
        address,
        amount: 100 // Increased from 1 to 100 sompi for dust threshold
      }],
      changeAddress: address,
      priorityFee: 0.01,
      type: 'commit',
      inscriptionProtocol: 'domain'
    };

    const revealData = {
      outputs: [{
        address: p2shAddress,
        amount: revealAmount
      }],
      changeAddress: address,
      priorityFee: 0.02,
      type: 'reveal',
      inscriptionProtocol: 'domain'
    };

    // Log the final data structures before returning
    console.log('Commit Data:', JSON.stringify(commitData, null, 2));
    console.log('Reveal Data:', JSON.stringify(revealData, null, 2));
    console.log('Network ID:', networkId);
    console.log('Script:', script.toString());

    return {
      script: script.toString(),
      commitData,
      revealData,
      networkId,
    };
  }

  private async verifyDomainOwnership(domain: string, ownerAddress: string): Promise<DomainVerificationResult> {
    try {
      const response = await fetch(`https://api.knsdomains.org/tn10/api/v1/${domain}/owner`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        return { success: false, message: data.message };
      }
      
      if (data.data.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
        return { success: false, message: 'Address does not match domain owner' };
      }
      
      return { success: true, data: data.data };
    } catch (error) {
      console.error('Domain verification failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
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
      fee
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
    submitTx: (
      commit: any,
      reveal: any,
      script: string,
      networkId: string,
      options?: any
    ) => Promise<CommitRevealResult>,
    backendRequest: (
      request: DomainRegistrationRequest
    ) => Promise<DomainRegistrationResponse>
  ): Promise<CommitRevealResult> {
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

    // Send to backend
    const backendResponse = await backendRequest(registrationRequest);

    // Process backend response
    const { script, commitData, revealData } = 
      await this.processBackendResponse(backendResponse);

    // Submit transaction through Kasware
    return submitTx(commitData, revealData, script, network, {
      inscriptionProtocol: 'domain'
    });
  }

  async submitInscription(
    domain: string,
    publicKey: XOnlyPublicKey,
    entries: IUtxoEntry[],
    address: string,
    network: string,
    submitTx: (
      commit: any,
      reveal: any,
      script: string,
      networkId: string,
      options?: any
    ) => Promise<CommitRevealResult>
  ): Promise<CommitRevealResult> {
    const { script, commitData, revealData, networkId } =
      await this.createDomainInscription(
        domain,
        publicKey,
        entries,
        address,
        network
      );

    // Log the data right before submission
    console.log('Submitting commit/reveal with:');
    console.log('Commit Data:', JSON.stringify(commitData, null, 2));
    console.log('Reveal Data:', JSON.stringify(revealData, null, 2));
    console.log('Network ID:', networkId);

    // Simplified options to avoid potential conflicts
    const options = {
      inscriptionProtocol: 'domain'
    };

    try {
      console.log('Final transaction data:');
      console.log('Commit:', JSON.stringify(commitData, null, 2));
      console.log('Reveal:', JSON.stringify(revealData, null, 2));
      console.log('NetworkID:', networkId);
      console.log('Script:', script);
      
      return submitTx(commitData, revealData, script, networkId, options);
    } catch (error) {
      console.error('Submit transaction error:', error);
      throw error;
    }
  }
}

export const knsInscriptionService = new KNSInscriptionService();
