import { Component, ElementRef, AfterViewInit, OnDestroy, viewChild } from '@angular/core';

interface CanvasNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hasConnections: boolean;
  targetOpacity: number;
  opacity: number;
  isVisible: boolean;
  fadeStart: number;
}

@Component({
  selector: 'app-startup-background-canvas',
  standalone: true,
  template: `<canvas #canvas class="background-canvas"></canvas>`,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: -1;
      pointer-events: none;
      display: block;
    }

    .background-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `]
})
export class StartupBackgroundCanvasComponent implements AfterViewInit, OnDestroy {
  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private nodes: CanvasNode[] = [];
  private animationFrameId: number = 0;
  private resizeListener?: () => void;

  private readonly config = {
    nodeColor: '#6FC7BA',
    lineColor: 'rgba(111, 199, 186, 0.45)',
    nodeCount: 26,
    connectionProbability: 0.6,
    maxDistance: 180,
    nodeMinSize: 2.5,
    nodeMaxSize: 6.5,
    speed: 0.65,
    fadeDuration: 350,
    fadeDelay: 30,
  };

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef().nativeElement;
    const context = this.canvas.getContext('2d');
    
    if (!context) {
      console.warn('Canvas 2D context not available');
      return;
    }

    this.ctx = context;
    this.resizeCanvas();
    this.createNodes();
    this.startAnimation();

    // Setup resize listener
    this.resizeListener = () => this.handleResize();
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private createNode(delayMs: number): CanvasNode {
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * this.config.speed,
      vy: (Math.random() - 0.5) * this.config.speed,
      radius:
        Math.random() * (this.config.nodeMaxSize - this.config.nodeMinSize) +
        this.config.nodeMinSize,
      hasConnections: Math.random() < this.config.connectionProbability,
      targetOpacity: Math.random() * 0.6 + 0.4,
      opacity: 0,
      isVisible: false,
      fadeStart: performance.now() + delayMs,
    };
  }

  private createNodes(): void {
    this.nodes = [];
    for (let i = 0; i < this.config.nodeCount; i++) {
      this.nodes.push(this.createNode(i * this.config.fadeDelay));
    }
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private handleResize(): void {
    this.resizeCanvas();
    this.createNodes();
  }

  private updateNode(node: CanvasNode, now: number): void {
    if (!node.isVisible && now >= node.fadeStart) {
      node.isVisible = true;
    }

    if (!node.isVisible) return;

    const fadeProgress = Math.min(1, (now - node.fadeStart) / this.config.fadeDuration);
    node.opacity = node.targetOpacity * fadeProgress;

    node.x += node.vx;
    node.y += node.vy;

    if (node.x <= node.radius || node.x >= this.canvas.width - node.radius) {
      node.vx = -node.vx;
    }
    if (node.y <= node.radius || node.y >= this.canvas.height - node.radius) {
      node.vy = -node.vy;
    }

    node.x = Math.max(node.radius, Math.min(this.canvas.width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(this.canvas.height - node.radius, node.y));
  }

  private drawConnections(): void {
    this.ctx.lineWidth = 1.25;
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      if (!nodeA.isVisible || nodeA.opacity <= 0) continue;

      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        if (!nodeB.isVisible || nodeB.opacity <= 0) continue;
        if (!nodeA.hasConnections || !nodeB.hasConnections) continue;

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.hypot(dx, dy);

        if (distance > this.config.maxDistance) continue;

        const distanceOpacity = 1 - distance / this.config.maxDistance;
        const averageOpacity = (nodeA.opacity + nodeB.opacity) * 0.5;

        this.ctx.strokeStyle = this.config.lineColor;
        this.ctx.globalAlpha = distanceOpacity * averageOpacity;
        this.ctx.beginPath();
        this.ctx.moveTo(nodeA.x, nodeA.y);
        this.ctx.lineTo(nodeB.x, nodeB.y);
        this.ctx.stroke();
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private drawNodes(): void {
    for (const node of this.nodes) {
      if (!node.isVisible || node.opacity <= 0) continue;

      this.ctx.globalAlpha = node.opacity;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.config.nodeColor;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  private animate = (): void => {
    const now = performance.now();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const node of this.nodes) {
      this.updateNode(node, now);
    }

    this.drawConnections();
    this.drawNodes();

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private startAnimation(): void {
    this.animate();
  }
}

