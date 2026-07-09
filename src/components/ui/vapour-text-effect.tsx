"use client";

import React, { useEffect, useRef } from "react";

interface VapourTextEffectProps {
  text: string;
  className?: string;
  particleColor?: string;
  textSize?: number;
}

export function VapourTextEffect({ 
  text, 
  className = "",
  particleColor = "rgba(255, 255, 255, 0.8)",
  textSize = 50
}: VapourTextEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationId: number;
    let isVaporizing = false;
    let textOpacity = 1;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      baseX: number;
      baseY: number;
      density: number;
      opacity: number;
      speedY: number;
      speedX: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.size = Math.random() * 1.5 + 0.5;
        this.density = (Math.random() * 20) + 1;
        this.opacity = Math.random() * 0.8 + 0.2;
        // Vapour floats up randomly
        this.speedY = Math.random() * -1.5 - 0.5;
        this.speedX = Math.random() * 1.5 - 0.75;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = particleColor.replace(/[\d.]+\)$/g, `${this.opacity})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }

      update(mouse: {x: number, y: number, radius: number}) {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          isVaporizing = true;
          let forceDirectionX = dx / distance;
          let forceDirectionY = dy / distance;
          let maxDistance = mouse.radius;
          let force = (maxDistance - distance) / maxDistance;
          let directionX = forceDirectionX * force * this.density;
          let directionY = forceDirectionY * force * this.density;
          
          this.x -= directionX;
          this.y -= directionY;
        } else if (isVaporizing) {
          // Continuous vapour flow
          this.x += this.speedX;
          this.y += this.speedY;
          this.opacity -= 0.01;

          if (this.opacity <= 0) {
            this.x = this.baseX;
            this.y = this.baseY;
            this.opacity = Math.random() * 0.8 + 0.2;
          }
        }
        
        // Return to base if not vaporizing
        if (!isVaporizing && this.opacity > 0) {
           if (this.x !== this.baseX) {
              this.x -= (this.x - this.baseX) / 10;
           }
           if (this.y !== this.baseY) {
              this.y -= (this.y - this.baseY) / 10;
           }
        }

        this.draw();
      }
    }

    const init = () => {
      particles = [];
      resizeCanvas();
      
      ctx.fillStyle = "white";
      ctx.font = `bold ${textSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      const textData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0, y2 = textData.height; y < y2; y += 4) {
        for (let x = 0, x2 = textData.width; x < x2; x += 4) {
          if (textData.data[(y * 4 * textData.width) + (x * 4) + 3] > 128) {
            particles.push(new Particle(x, y));
          }
        }
      }
      
      // Auto vaporize after 2 seconds
      setTimeout(() => {
        isVaporizing = true;
      }, 2000);
    };

    let mouse = { x: -1000, y: -1000, radius: 50 };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(mouse);
      }
      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      isVaporizing = true; // Trigger vapor on hover
    };
    
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [text, particleColor, textSize]);

  return (
    <div ref={containerRef} className={`w-full h-[150px] relative overflow-hidden group cursor-pointer ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-auto" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-1000">
         <span className="text-white/20 text-xs tracking-widest uppercase">Vaporizing...</span>
      </div>
    </div>
  );
}
