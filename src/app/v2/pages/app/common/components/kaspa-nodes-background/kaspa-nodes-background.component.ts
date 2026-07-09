import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Input,
} from '@angular/core';

class GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hasConnections: boolean;
  opacity: number;
  targetOpacity: number;
  fadeInStartTime: number;
  fadeInDuration: number;
  isVisible: boolean;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    config: any,
    delayMs: number = 0,
  ) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * config.speed;
    this.vy = (Math.random() - 0.5) * config.speed;
    this.radius =
      Math.random() * (config.nodeMaxSize - config.nodeMinSize) +
      config.nodeMinSize;
    this.hasConnections = Math.random() < config.connectionProbability;
    // Random target opacity between 0.3 and 1.0 for variety
    this.targetOpacity = Math.random() * 0.7 + 0.3;
    this.opacity = 0; // Start with 0 opacity for fade-in effect
    this.fadeInStartTime = Date.now() + delayMs;
    this.fadeInDuration = 400; // 400ms fade-in duration for faster appearance
    this.isVisible = false;
  }

  update(canvasWidth: number, canvasHeight: number) {
    // Handle fade-in animation
    const currentTime = Date.now();
    if (!this.isVisible && currentTime >= this.fadeInStartTime) {
      this.isVisible = true;
    }

    if (this.isVisible) {
      const fadeProgress = Math.min(
        1,
        (currentTime - this.fadeInStartTime) / this.fadeInDuration,
      );
      this.opacity = this.targetOpacity * fadeProgress;
    }

    // Only move if visible
    if (this.isVisible) {
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
      this.x = Math.max(
        this.radius,
        Math.min(canvasWidth - this.radius, this.x),
      );
      this.y = Math.max(
        this.radius,
        Math.min(canvasHeight - this.radius, this.y),
      );
    }
  }

  draw(ctx: CanvasRenderingContext2D, nodeColor: string) {
    if (this.opacity <= 0) return; // Don't draw invisible nodes

    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor;
    ctx.fill();
    ctx.globalAlpha = 1; // Reset alpha for other drawing operations
  }
}

export interface KaspaNodesConfig {
  nodeColor?: string;
  lineColor?: string;
  nodeCount?: number;
  connectionProbability?: number;
  maxDistance?: number;
  nodeMinSize?: number;
  nodeMaxSize?: number;
  speed?: number;
  fadeInSequenceDelay?: number;
}

@Component({
  selector: 'kaspa-nodes-background',
  standalone: true,
  imports: [],
  template: ` <canvas #backgroundCanvas class="kaspa-nodes-canvas"> </canvas> `,
  styleUrls: ['./kaspa-nodes-background.component.scss'],
})
export class KaspaNodesBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('backgroundCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() config: KaspaNodesConfig = {};

  private animationId: number | null = null;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private nodes: GraphNode[] = [];
  private resizeListener?: () => void;
  private resizeObserver?: ResizeObserver;

  private readonly defaultConfig: Required<KaspaNodesConfig> = {
    nodeColor: '#6FC7BA', // Kaspa teal color for nodes
    lineColor: '#6e6e6e', // Gray color for connection lines
    nodeCount: 24, // Fixed to always show 24 nodes
    connectionProbability: 0.6,
    maxDistance: 150,
    nodeMinSize: 3,
    nodeMaxSize: 8,
    speed: 0.8,
    fadeInSequenceDelay: 25, // 25ms delay between each node appearing for faster sequence
  };

  private get mergedConfig(): Required<KaspaNodesConfig> {
    return { ...this.defaultConfig, ...this.config };
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

    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private initCanvas() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Set initial canvas size
    this.resizeCanvas();

    // Use ResizeObserver to watch for container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvas.parentElement!);

    // Fallback to window resize listener
    this.resizeListener = () => this.resizeCanvas();
    window.addEventListener('resize', this.resizeListener);
  }

  private resizeCanvas() {
    const container = this.canvas.parentElement;
    if (!container) return;

    // Use the container's client dimensions (content area without padding/borders)
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Set canvas dimensions to match container exactly
    this.canvas.width = width;
    this.canvas.height = height;

    // Also set CSS dimensions to prevent scaling issues
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Recreate nodes with new canvas dimensions if nodes exist
    if (this.nodes.length > 0) {
      this.createNodes();
    }
  }

  private createNodes() {
    this.nodes = [];
    const config = this.mergedConfig;

    // Create exactly 24 nodes with sequential fade-in animation
    for (let i = 0; i < config.nodeCount; i++) {
      const delayMs = i * config.fadeInSequenceDelay;
      this.nodes.push(
        new GraphNode(this.canvas.width, this.canvas.height, config, delayMs),
      );
    }
  }

  private drawConnections() {
    const config = this.mergedConfig;
    this.ctx.strokeStyle = config.lineColor;
    this.ctx.lineWidth = 1.5;

    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].hasConnections || this.nodes[i].opacity <= 0) continue;

      for (let j = i + 1; j < this.nodes.length; j++) {
        if (!this.nodes[j].hasConnections || this.nodes[j].opacity <= 0)
          continue;

        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < config.maxDistance) {
          const distanceOpacity = 1 - distance / config.maxDistance;
          const averageNodeOpacity =
            (this.nodes[i].opacity + this.nodes[j].opacity) / 2;
          this.ctx.globalAlpha = distanceOpacity * averageNodeOpacity * 0.7; // Increased opacity for better visibility

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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw connections first (so they appear behind nodes)
    this.drawConnections();

    // Update and draw nodes
    this.nodes.forEach((node) => {
      node.update(this.canvas.width, this.canvas.height);
      node.draw(this.ctx, this.mergedConfig.nodeColor);
    });

    this.animationId = requestAnimationFrame(this.animate);
  };

  private startAnimation() {
    this.animate();
  }
}
