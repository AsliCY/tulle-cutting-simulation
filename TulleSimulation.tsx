import React, { useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface MousePosition extends Position {
  x: number;
  y: number;
}

class Point {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  pinned: boolean;
  broken: boolean;
  connections: Set<Constraint>;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.pinned = false;
    this.broken = false;
    this.connections = new Set();
  }

  update(): void {
    if (this.pinned) return;

    const vx = (this.x - this.oldX) * 0.98;
    const vy = (this.y - this.oldY) * 0.98;

    this.oldX = this.x;
    this.oldY = this.y;

    const time = Date.now() * 0.0003;
    const waveX = Math.sin(time + this.y * 0.01) * 0.02;
    const waveY = Math.cos(time + this.x * 0.01) * 0.02;

    this.x += vx + waveX;
    this.y += vy + waveY;
    this.y += 0.1;

    if (this.y > window.innerHeight + 100) {
      this.broken = true;
    }
  }
}

class Constraint {
  p1: Point;
  p2: Point;
  length: number;
  broken: boolean;

  constructor(p1: Point, p2: Point) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    this.broken = false;
    p1.connections.add(this);
    p2.connections.add(this);
  }

  resolve(): boolean {
    if (this.broken) return false;

    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const currentLength = Math.hypot(dx, dy);
    
    if (currentLength > this.length * 2.5) {
      this.broken = true;
      this.p1.connections.delete(this);
      this.p2.connections.delete(this);
      return false;
    }

    const diff = (currentLength - this.length) / currentLength;
    const offsetX = dx * diff * 0.5;
    const offsetY = dy * diff * 0.5;

    if (!this.p1.pinned) {
      this.p1.x += offsetX;
      this.p1.y += offsetY;
    }
    if (!this.p2.pinned) {
      this.p2.x -= offsetX;
      this.p2.y -= offsetY;
    }

    return true;
  }
}

const TulleSimulation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePos = useRef<MousePosition>({ x: 0, y: 0 });
  const lastMousePos = useRef<MousePosition>({ x: 0, y: 0 });
  const isDragging = useRef<boolean>(false);
  const points = useRef<Point[]>([]);
  const constraints = useRef<Constraint[]>([]);
  const width = 60;
  const height = 45;

  const tearTulle = (x: number, y: number): void => {
    const dx = mousePos.current.x - lastMousePos.current.x;
    const dy = mousePos.current.y - lastMousePos.current.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 0.1) return;

    const bladeWidth = 4.5;
    const bladeSharpness = 0.95;   // 0.99'dan 0.95'e düşürüldü
    const extendedCut = 1.2;       // 1.5'ten 1.2'ye düşürüldü
    const neighborCutChance = 0.3;  // 0.4'ten 0.3'e düşürüldü
    const neighborCutRadius = bladeWidth * 2; // 2.5'ten 2'ye düşürüldü
    
    points.current.forEach(point => {
      const lineDistance = Math.abs(
        (dy * point.x - dx * point.y + 
          mousePos.current.x * lastMousePos.current.y - 
          mousePos.current.y * lastMousePos.current.x) / distance
      );

      if (lineDistance < bladeWidth * extendedCut) {
        const t = (
          (point.x - lastMousePos.current.x) * dx + 
          (point.y - lastMousePos.current.y) * dy
        ) / (dx * dx + dy * dy);

        if (t >= -0.2 && t <= 1.2 && Math.random() < bladeSharpness) {
          point.broken = true;
          [...point.connections].forEach(constraint => {
            const otherPoint = constraint.p1 === point ? constraint.p2 : constraint.p1;
            const otherSide = (
              (otherPoint.x - point.x) * dy - 
              (otherPoint.y - point.y) * dx
            ) > -bladeWidth;

            if (otherSide || Math.random() < neighborCutChance) {
              constraint.broken = true;
              point.connections.delete(constraint);
              
              if (otherPoint.connections.size === 0) {
                otherPoint.pinned = false;
              }
            }
          });

          points.current.forEach(nearPoint => {
            if (!nearPoint.broken && nearPoint !== point) {
              const nearDist = Math.hypot(nearPoint.x - point.x, nearPoint.y - point.y);
              if (nearDist < neighborCutRadius && Math.random() < neighborCutChance) {
                nearPoint.broken = true;
                [...nearPoint.connections].forEach(c => {
                  c.broken = true;
                  nearPoint.connections.delete(c);
                });
              }
            }
          });
        }
      }
    });
  };

  const initTulle = (): void => {
    const spacing = 8;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = new Point(
          window.innerWidth/2 - (width * spacing)/2 + x * spacing,
          window.innerHeight/3 + y * spacing
        );
        
        if (y === 0 && (x % 15 === 0 || x === width-1)) {
          p.pinned = true;
        }
        
        points.current.push(p);
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        
        if (x < width - 1) {
          constraints.current.push(new Constraint(points.current[i], points.current[i + 1]));
        }
        if (y < height - 1) {
          constraints.current.push(new Constraint(points.current[i], points.current[i + width]));
        }

        if (x < width - 1 && y < height - 1) {
          constraints.current.push(new Constraint(points.current[i], points.current[i + width + 1]));
          constraints.current.push(new Constraint(points.current[i + 1], points.current[i + width]));
        }
      }
    }
  };

  const update = (): void => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (isDragging.current && 
        (Math.abs(mousePos.current.x - lastMousePos.current.x) > 0.1 || 
         Math.abs(mousePos.current.y - lastMousePos.current.y) > 0.1)) {
      const steps = 2;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = lastMousePos.current.x + (mousePos.current.x - lastMousePos.current.x) * t;
        const y = lastMousePos.current.y + (mousePos.current.y - lastMousePos.current.y) * t;
        tearTulle(x, y);
      }
    }

    points.current = points.current.filter(point => {
      if (!point.broken) {
        if (point.connections.size === 0 && !point.pinned) {
          point.pinned = false;
        }
        point.update();
        return true;
      }
      return false;
    });

    for (let i = 0; i < 3; i++) {
      constraints.current = constraints.current.filter(constraint => 
        !constraint.broken && constraint.resolve()
      );
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;

    constraints.current.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.p1.x, c.p1.y);
      ctx.lineTo(c.p2.x, c.p2.y);
      ctx.stroke();
    });

    lastMousePos.current = {...mousePos.current};
    requestAnimationFrame(update);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    initTulle();
    update();

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseDown = (): void => {
      isDragging.current = true;
      lastMousePos.current = {...mousePos.current};
    };

    const handleMouseUp = (): void => {
      isDragging.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="bg-black w-full h-screen">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
      />
      <div className="absolute top-4 left-4 text-white opacity-60">
        Fare ile sürükleyerek tülü kesebilirsiniz
      </div>
    </div>
  );
};

export default TulleSimulation;