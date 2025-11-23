import { Component, inject, signal, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { navAnimation } from './common/animation/nav.animation';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { FlowPageComponent } from './common/flow-page/flow-page.component';
import { AccountSettingsService } from '../../services/account-settings.service';
import { FlowPagesService } from '../../services/flow-pages.service';
import { QuickActionDialogService } from '../../services/quick-action-dialog.service';
import { ReviewActionComponent } from '../../../components/wallet-actions-reviews/review-action/review-action.component';
import { DynamicFlowPageOutletComponent } from './common/flow-page/dynamic-flow-page-outlet.component';
import { DynamicQuickActionDialogOutletComponent } from './common/quick-action-dialog/dynamic-quick-action-dialog-outlet.component';
import { IFrameCommunicationApp } from '../../../services/communication-service/communication-app/iframe-communication.service';
import { IframeAccountSelectionComponent } from './iframe-account-selection/iframe-account-selection.component';
import { IframeAccountSelectionService } from '../../services/iframe-account-selection.service';

import { KcSnackbarComponent, KcSpinnerComponent } from '@kaspacom/ui';
import { WalletService } from '../../../services/wallet.service';
import { AssetsManagerService } from '../../../services/assets-manager/assets-manager.service';

@Component({
  selector: 'app-app-wrapper',
  imports: [
    CommonModule,
    RouterOutlet,
    WrapperHeaderComponent,
    WrapperNavComponent,
    FlowPageComponent,
    DynamicFlowPageOutletComponent,
    DynamicQuickActionDialogOutletComponent,
    ReviewActionComponent,
    KcSnackbarComponent,
    KcSpinnerComponent,
    IframeAccountSelectionComponent,
  ],
  templateUrl: './app-wrapper.component.html',
  styleUrl: './app-wrapper.component.scss',
  animations: [navAnimation],
})
export class AppWrapperComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphCanvas', { static: false })
  graphCanvas!: ElementRef<HTMLCanvasElement>;

  private contexts = inject(ChildrenOutletContexts);
  accountSettingsService = inject(AccountSettingsService);
  flowPagesService = inject(FlowPagesService);
  quickActionDialogService = inject(QuickActionDialogService);
  private walletService = inject(WalletService);
  protected assetsManager = inject(AssetsManagerService);
  iframeAccountSelectionService = inject(IframeAccountSelectionService);
  shouldEnforceAccountSelection = signal(this.iframeAccountSelectionService.shouldEnforceAccountSelection());

  // Detect if running in iframe mode
  isIframeMode = signal(IFrameCommunicationApp.isIframe());
  showIframeLoader = signal(false);

  // Computed signal to determine if account selection overlay should be shown
  shouldShowAccountSelectionOverlay = computed(() => {
    if (!this.shouldEnforceAccountSelection()) {
      return false;
    }
    const currentWallet = this.walletService.getCurrentWalletSignal()();
    // Show overlay when no wallet is selected
    return !currentWallet;
  });

  private ctx!: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private animationFrameId: number | null = null;
  private mouse = {
    x: null as number | null,
    y: null as number | null,
    radius: 150,
  };

  private boundResizeCanvas!: () => void;
  private boundMouseMove!: (e: MouseEvent) => void;
  private boundMouseLeave!: () => void;

  constructor() {
    // Overlay visibility is now managed by computed signal - no effect needed
  }

  ngOnInit(): void {
    // Nothing needed here for now
  }

  onAccountSelected(): void {
    // Account was selected - overlay will automatically hide via computed signal
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }

  onFlowPageBackdropClick() {
    // Handle backdrop click - for wallet management, we should close it
    // For other pages, navigate back or close based on navigation capability
    const activePage = this.flowPagesService.activePage();
    if (activePage?.id === 'wallet-management') {
      this.accountSettingsService.close();
    } else if (this.flowPagesService.canNavigateBack()) {
      this.flowPagesService.navigateBack();
    } else {
      this.flowPagesService.closePage();
    }
  }

  onFlowPageClose() {
    // Handle close icon click - close the current page
    const activePage = this.flowPagesService.activePage();
    if (activePage?.id === 'wallet-management') {
      this.accountSettingsService.close();
    } else {
      this.flowPagesService.closePage();
    }
  }

  onQuickActionDialogBackdropClick() {
    // Handle backdrop click - close the quick action dialog
    this.quickActionDialogService.closeDialog();
  }

  onQuickActionDialogClose() {
    // Handle close icon click - close the quick action dialog
    this.quickActionDialogService.closeDialog();
  }

  ngAfterViewInit(): void {
    this.initGraphAnimation();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.boundResizeCanvas);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseleave', this.boundMouseLeave);
  }

  private initGraphAnimation(): void {
    const canvas = this.graphCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    // Bind event handlers
    this.boundResizeCanvas = this.resizeCanvas.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseLeave = this.handleMouseLeave.bind(this);

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', this.boundResizeCanvas);

    // Mouse events
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mouseleave', this.boundMouseLeave);

    // Create nodes
    const nodeCount = 40;
    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push(new Node(canvas));
    }

    // Start animation
    this.animate();
  }

  private resizeCanvas(): void {
    const canvas = this.graphCanvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private handleMouseMove(e: MouseEvent): void {
    this.mouse.x = e.x;
    this.mouse.y = e.y;
  }

  private handleMouseLeave(): void {
    this.mouse.x = null;
    this.mouse.y = null;
  }

  private drawConnections(): void {
    const canvas = this.graphCanvas.nativeElement;
    const maxDistance = Math.max(canvas.width, canvas.height);

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // All nodes connected, opacity based on distance
        const opacity = Math.max(0.01, (1 - distance / maxDistance) * 0.05);

        this.ctx.beginPath();
        this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
        this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
        this.ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
      }
    }

    // Connect to mouse
    if (this.mouse.x != null && this.mouse.y != null) {
      for (let i = 0; i < this.nodes.length; i++) {
        const dx = this.mouse.x - this.nodes[i].x;
        const dy = this.mouse.y - this.nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.mouse.radius) {
          const opacity = (1 - distance / this.mouse.radius) * 0.5;

          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.strokeStyle = `rgba(255, 150, 100, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }
  }

  private animate(): void {
    const canvas = this.graphCanvas.nativeElement;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.shadowBlur = 0;

    // Draw connections first (so nodes appear on top)
    this.drawConnections();

    // Update and draw nodes
    this.nodes.forEach((node) => {
      node.update(this.mouse, canvas);
      node.draw(this.ctx);
    });

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}

class Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  originalRadius: number;

  constructor(canvas: HTMLCanvasElement) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
    this.originalRadius = this.radius;
  }

  update(
    mouse: { x: number | null; y: number | null; radius: number },
    canvas: HTMLCanvasElement,
  ): void {
    // Boundary collision
    if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
    if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

    // Move
    this.x += this.vx;
    this.y += this.vy;

    // Mouse interaction
    if (mouse.x != null && mouse.y != null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < mouse.radius) {
        // Repel from mouse
        const force = (mouse.radius - distance) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * force * 2;
        this.y -= Math.sin(angle) * force * 2;

        // Grow size
        this.radius = this.originalRadius + force * 3;
      } else {
        // Return to original size
        this.radius = this.originalRadius;
      }
    } else {
      this.radius = this.originalRadius;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.fill();

    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(100, 200, 255, 0.5)';
  }
}
