import { Injectable, inject } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { UtilsHelper } from './utils.service';
import { MessagePopupService } from './message-popup.service';

export interface QrScannerConfig {
  scannerId: string;
  title?: string;
  instruction?: string;
  successMessage?: string;
  validateAddress?: boolean;
  onSuccess: (data: string) => void;
  onError?: (error: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class QrScannerService {
  private utilsHelper = inject(UtilsHelper);
  private messagePopupService = inject(MessagePopupService);
  
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;
  private currentConfig: QrScannerConfig | null = null;

  async startScanning(config: QrScannerConfig): Promise<void> {
    if (this.isScanning) {
      this.stopScanning();
    }

    this.currentConfig = config;
    
    try {
      this.isScanning = true;
      
      // Create QR scanner instance with unique element ID
      const scannerId = config.scannerId;
      
      // Create scanner element dynamically
      const scannerElement = document.createElement('div');
      scannerElement.id = scannerId;
      scannerElement.style.position = 'fixed';
      scannerElement.style.top = '0';
      scannerElement.style.left = '0';
      scannerElement.style.width = '100%';
      scannerElement.style.height = '100%';
      scannerElement.style.background = 'rgba(0, 0, 0, 0.88)';
      scannerElement.style.backdropFilter = 'blur(8px)';
      scannerElement.style.zIndex = '9999';
      scannerElement.style.display = 'flex';
      scannerElement.style.flexDirection = 'column';
      scannerElement.style.alignItems = 'center';
      scannerElement.style.justifyContent = 'center';
      
      // Add header with title and close icon
      const header = document.createElement('div');
      header.style.position = 'absolute';
      header.style.top = '0';
      header.style.left = '0';
      header.style.width = '100%';
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.padding = '20px';
      header.style.background = 'rgba(0, 0, 0, 0.3)';
      header.style.backdropFilter = 'blur(10px)';
      
      // Add title
      const title = document.createElement('h2');
      title.textContent = config.title || 'Scan QR Code';
      title.style.color = 'white';
      title.style.fontSize = '20px';
      title.style.fontWeight = '600';
      title.style.margin = '0';
      
      // Add close icon container
      const closeIconContainer = document.createElement('div');
      closeIconContainer.style.padding = '8px';
      closeIconContainer.style.cursor = 'pointer';
      closeIconContainer.style.borderRadius = '8px';
      closeIconContainer.style.transition = 'background-color 0.2s ease';
      closeIconContainer.onclick = () => this.stopScanning();
      
      // Create close icon
      const closeIcon = document.createElement('div');
      closeIcon.innerHTML = '✕';
      closeIcon.style.color = 'white';
      closeIcon.style.fontSize = '24px';
      closeIcon.style.fontWeight = 'bold';
      closeIcon.style.lineHeight = '1';
      
      closeIconContainer.appendChild(closeIcon);
      header.appendChild(title);
      header.appendChild(closeIconContainer);
      
      // Add hover effect for close button
      closeIconContainer.addEventListener('mouseenter', () => {
        closeIconContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });
      closeIconContainer.addEventListener('mouseleave', () => {
        closeIconContainer.style.backgroundColor = 'transparent';
      });
      
      // Add scanner container
      const scannerContainer = document.createElement('div');
      scannerContainer.id = scannerId + '-camera';
      scannerContainer.style.width = '300px';
      scannerContainer.style.height = '300px';
      scannerContainer.style.border = '2px dashed var(--primary)';
      scannerContainer.style.borderRadius = '12px';
      scannerContainer.style.overflow = 'hidden';
      
      // Add instruction text
      const instruction = document.createElement('p');
      instruction.textContent = config.instruction || 'Point camera at QR code containing wallet address';
      instruction.style.color = 'white';
      instruction.style.textAlign = 'center';
      instruction.style.marginBottom = '20px';
      instruction.style.fontSize = '16px';
      
      scannerElement.appendChild(header);
      scannerElement.appendChild(instruction);
      scannerElement.appendChild(scannerContainer);
      document.body.appendChild(scannerElement);
      
      // Initialize HTML5-QRCode scanner
      this.html5QrCode = new Html5Qrcode(scannerContainer.id);
      
      const qrConfig = {
        fps: 10,
        qrbox: { width: 290, height: 290 }, // Make it fill almost the entire 300x300 container
        aspectRatio: 1.0
      };

      // Get available cameras and start scanning
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        // Prefer back camera for better QR scanning
        const cameraId = devices.find(d => d.label.toLowerCase().includes('back'))?.id || devices[0].id;
        
        await this.html5QrCode.start(
          cameraId,
          qrConfig,
          (decodedText: string) => {
            this.handleQrCodeDetected(decodedText);
          },
          (errorMessage: string) => {
            // Ignore scanning errors, they're normal during scanning
            console.debug('QR scan error:', errorMessage);
          }
        );
      } else {
        throw new Error('No cameras found');
      }
    } catch (error) {
      console.error('Failed to start QR scanning:', error);
      this.messagePopupService.showError('Failed to access camera. Please check permissions.');
      this.stopScanning();
      config.onError?.('Failed to access camera');
    }
  }

  async stopScanning(): Promise<void> {
    if (this.html5QrCode) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode = null;
      } catch (err) {
        console.error('Error stopping QR scanner:', err);
      }
    }
    
    // Remove scanner element from DOM
    if (this.currentConfig) {
      const scannerElements = document.querySelectorAll(`[id^="${this.currentConfig.scannerId}"]`);
      scannerElements.forEach(element => element.remove());
    }
    
    this.isScanning = false;
    this.currentConfig = null;
  }

  private handleQrCodeDetected(qrText: string): void {
    console.log('QR Code detected:', qrText);
    
    if (!this.currentConfig) {
      return;
    }
    
    // If validateAddress is false, pass raw data directly
    if (this.currentConfig.validateAddress === false) {
      this.currentConfig.onSuccess(qrText.trim());
      const successMsg = this.currentConfig.successMessage || 'QR code scanned successfully!';
      this.messagePopupService.showSuccess(successMsg);
      this.stopScanning();
      return;
    }
    
    // Extract wallet address from QR code (it might be just the address or a URL)
    let address = qrText.trim();
    
    // Handle kaspa: URI format
    if (address.startsWith('kaspa:')) {
      address = address.substring(6);
    }
    
    // Validate the address
    if (this.utilsHelper.isValidWalletAddress(address)) {
      this.currentConfig.onSuccess(address);
      const successMsg = this.currentConfig.successMessage || 'Wallet address scanned successfully!';
      this.messagePopupService.showSuccess(successMsg);
      this.stopScanning();
    } else {
      const errorMsg = 'Invalid wallet address in QR code';
      this.messagePopupService.showError(errorMsg);
      this.currentConfig.onError?.(errorMsg);
    }
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }
} 