import { Component, computed, inject, Input, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApprovalFlowService } from '../../../../common/services/approval-flow.service';
import { KcIconComponent } from 'kaspacom-ui';

class GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hasConnections: boolean;
  opacity: number;

  constructor(canvasWidth: number, canvasHeight: number, config: any) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * config.speed;
    this.vy = (Math.random() - 0.5) * config.speed;
    this.radius = Math.random() * (config.nodeMaxSize - config.nodeMinSize) + config.nodeMinSize;
    this.hasConnections = Math.random() < config.connectionProbability;
    // Random opacity between 0.3 and 1.0 for variety
    this.opacity = Math.random() * 0.7 + 0.3;
  }

  update(canvasWidth: number, canvasHeight: number) {
    this.x += this.vx;
    this.y += this.vy;
    
    // Bounce off edges
    if (this.x <= this.radius || this.x >= canvasWidth - this.radius) {
      this.vx = -this.vx;
    }
    if (this.y <= this.radius || this.y >= canvasHeight - this.radius) {
      this.vy = -this.vy;
    }
    
    // Keep within bounds
    this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
  }

  draw(ctx: CanvasRenderingContext2D, nodeColor: string) {
    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor;
    ctx.fill();
    ctx.globalAlpha = 1; // Reset alpha for other drawing operations
  }
}

@Component({
  selector: 'app-approval-loading-page',
  standalone: true,
  imports: [
    CommonModule,
    KcIconComponent
  ],
  template: `
    <div class="loading-container">
      <!-- Background Canvas -->
      <canvas #backgroundCanvas class="background-canvas"></canvas>
      
      <!-- Loading Header -->
      <div class="loading-header">
        <div class="loading-icon-wrapper">
          <div class="loading-spinner">
            <kc-icon 
              [iconClass]="'icon-refresh'" 
              [size]="'xlg'"
              class="spinner-icon">
            </kc-icon>
          </div>
        </div>
        <h2 class="loading-title">Processing Transaction</h2>
        <p class="loading-subtitle">Please wait while your transaction is being processed...</p>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            [style.width.%]="currentProgress()">
          </div>
        </div>
        <div class="progress-text">
          {{ currentProgress() }}%
        </div>
      </div>

      <!-- Loading Steps -->
      <div class="loading-steps">
        <div class="step" [class.active]="currentProgress() >= 50">
          <div class="step-icon">
            <kc-icon 
              [iconClass]="currentProgress() >= 50 ? 'icon-check' : 'icon-clock'" 
              [size]="'sm'">
            </kc-icon>
          </div>
          <span class="step-text">Commit transaction</span>
        </div>
        
        <div class="step" [class.active]="currentProgress() >= 100">
          <div class="step-icon">
            <kc-icon 
              [iconClass]="currentProgress() >= 100 ? 'icon-check' : 'icon-clock'" 
              [size]="'sm'">
            </kc-icon>
          </div>
          <span class="step-text">Reveal transaction</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './approval-loading-page.component.scss'
})
export class ApprovalLoadingPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('backgroundCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private approvalFlowService = inject(ApprovalFlowService);
  private animationId: number | null = null;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private nodes: GraphNode[] = [];
  private resizeListener?: () => void;
  
  private readonly config = {
    nodeColor: '#6FC7BA',
    lineColor: '#404040',
    nodeCount: 50,
    connectionProbability: 0.6,
    maxDistance: 150,
    nodeMinSize: 3,
    nodeMaxSize: 8,
    speed: 0.8
  };
  
  currentProgress = computed(() => this.approvalFlowService.currentProgress());

  ngOnInit() {
    // Component initialization
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initCanvas();
      this.createNodes();
      this.startAnimation();
    }, 100);
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Clean up resize listener
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private initCanvas() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Set canvas size to match container
    this.resizeCanvas();
    
    // Store resize listener reference for cleanup
    this.resizeListener = () => this.resizeCanvas();
    window.addEventListener('resize', this.resizeListener);
  }

  private resizeCanvas() {
    // Use full viewport dimensions
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Recreate nodes with new canvas dimensions if nodes exist
    if (this.nodes.length > 0) {
      this.createNodes();
    }
  }

  private createNodes() {
    this.nodes = [];
    
    // Create nodes spread across the canvas
    for (let i = 0; i < this.config.nodeCount; i++) {
      this.nodes.push(new GraphNode(this.canvas.width, this.canvas.height, this.config));
    }
  }

  private drawConnections() {
    this.ctx.strokeStyle = this.config.lineColor; // #404040 gray
    this.ctx.lineWidth = 1.5; // Make lines slightly thicker for better visibility
    
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].hasConnections) continue;
      
      for (let j = i + 1; j < this.nodes.length; j++) {
        if (!this.nodes[j].hasConnections) continue;
        
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.config.maxDistance) {
          const distanceOpacity = 1 - (distance / this.config.maxDistance);
          // Use average opacity of the two connected nodes
          const averageNodeOpacity = (this.nodes[i].opacity + this.nodes[j].opacity) / 2;
          this.ctx.globalAlpha = distanceOpacity * averageNodeOpacity * 0.6;
          
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.stroke();
        }
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private animate = () => {
    // Clear with transparent background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw connections first (so they appear behind nodes)
    this.drawConnections();
    
    // Update and draw nodes
    this.nodes.forEach(node => {
      node.update(this.canvas.width, this.canvas.height);
      node.draw(this.ctx, this.config.nodeColor);
    });
    
    this.animationId = requestAnimationFrame(this.animate);
  }

  private startAnimation() {
    this.animate();
  }
} 