"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CELL = 60;
const BLOCK_SIZE = 59;
const TICK_MS = 300;

type Dir = "up" | "down" | "left" | "right";

const DX: Record<Dir, number> = { left: -1, right: 1, up: 0, down: 0 };
const DY: Record<Dir, number> = { left: 0, right: 0, up: -1, down: 1 };
const REVERSE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

type GridInfo = {
  cols: number;
  rows: number;
  forbidden: Set<string>;
};

type BlockState = {
  id: number;
  col: number;
  row: number;
  dir: Dir;
  stopped?: boolean;
  label?: string;
};

function Block({
  col,
  row,
  stopped,
  hovered,
  label,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  col: number;
  row: number;
  stopped?: boolean;
  hovered?: boolean;
  label?: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const x = col * CELL + 1;
  const y = row * CELL + 1;
  const paused = hovered && !stopped;
  const displayLabel = paused ? "Agent paused" : label;
  return (
    <span
      className={`hero-grid-box ${stopped || paused ? "" : "hero-grid-box-movable"}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        transform: `translate(${x}px, ${y}px)`,
        left: 0,
        top: 0,
      }}
    >
      <span className="hero-grid-box-tooltip">
        {stopped ? "Click to activate" : "Click to stop"}
      </span>
      {displayLabel && (
        <span className="hero-grid-box-label">{displayLabel}</span>
      )}
    </span>
  );
}

function buildForbidden(cols: number, rows: number): Set<string> {
  const fb = new Set<string>();
  const colMargin = 2;
  const rowMargin = 1;
  for (let c = colMargin; c < cols - colMargin; c++) {
    for (let r = rowMargin; r < rows - rowMargin; r++) {
      fb.add(`${c},${r}`);
    }
  }
  return fb;
}

export default function HeroGridBlocks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridInfo>({ cols: 0, rows: 0, forbidden: new Set() });

  useEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) {
        return;
      }
      const { width, height } = el.getBoundingClientRect();
      const cols = Math.floor(width / CELL);
      const rows = Math.floor(height / CELL);
      gridRef.current = { cols, rows, forbidden: buildForbidden(cols, rows) };
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);

  const [blocks, setBlocks] = useState<BlockState[]>(() => [
    { id: 0, col: 0, row: 0, dir: "right" },
    { id: 1, col: 1, row: 3, dir: "down", label: "Your agent tomorrow" },
    {
      id: 3,
      col: 4,
      row: 0,
      dir: "left",
      stopped: true,
      label: "Your agent today",
    },
  ]);

  const handleBlockHover = useCallback((id: number) => {
    hoveredRef.current = id;
    setHoveredId(id);
  }, []);

  const handleBlockLeave = useCallback(() => {
    hoveredRef.current = null;
    setHoveredId(null);
  }, []);

  const handleBlockClick = useCallback((id: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) {
          return b;
        }
        if (b.stopped) {
          return { ...b, stopped: false, label: "Agent activated" };
        }
        return { ...b, stopped: true, label: "Agent stopped" };
      })
    );
  }, []);

  const tick = useCallback(() => {
    setBlocks((prev) => {
      const { cols, rows, forbidden } = gridRef.current;
      if (cols < 4 || rows < 3) {
        return prev;
      }

      const next = prev.map((b) => ({ ...b }));
      const occupied = new Set(next.map((b) => `${b.col},${b.row}`));
      const vacatedTo = new Map<string, string>();

      next.forEach((b) => {
        if (b.stopped || b.id === hoveredRef.current) {
          return;
        }

        if (b.col < 0 || b.col >= cols || b.row < 0 || b.row >= rows) {
          b.col = 0;
          b.row = 0;
        }

        const myPos = `${b.col},${b.row}`;

        function canGo(c: number, r: number): boolean {
          if (c < 0 || c >= cols || r < 0 || r >= rows) {
            return false;
          }
          const k = `${c},${r}`;
          return (
            !forbidden.has(k) && !occupied.has(k) && vacatedTo.get(k) !== myPos
          );
        }

        const [nc, nr] = [b.col + DX[b.dir], b.row + DY[b.dir]];

        if (Math.random() < 0.12) {
          const perp: Dir[] =
            b.dir === "left" || b.dir === "right"
              ? ["up", "down"]
              : ["left", "right"];
          if (Math.random() < 0.5) {
            perp.reverse();
          }
          for (const d of perp) {
            const [tc, tr] = [b.col + DX[d], b.row + DY[d]];
            if (canGo(tc, tr)) {
              occupied.delete(myPos);
              b.col = tc;
              b.row = tr;
              b.dir = d;
              const np = `${tc},${tr}`;
              occupied.add(np);
              vacatedTo.set(myPos, np);
              return;
            }
          }
        }

        if (canGo(nc, nr)) {
          occupied.delete(myPos);
          b.col = nc;
          b.row = nr;
          const nk = `${nc},${nr}`;
          occupied.add(nk);
          vacatedTo.set(myPos, nk);
          return;
        }

        const perp: Dir[] =
          b.dir === "left" || b.dir === "right"
            ? ["up", "down"]
            : ["left", "right"];
        if (Math.random() < 0.5) {
          perp.reverse();
        }
        const tryDirs = [...perp, REVERSE[b.dir]];

        for (const d of tryDirs) {
          const [tc, tr] = [b.col + DX[d], b.row + DY[d]];
          if (canGo(tc, tr)) {
            occupied.delete(myPos);
            b.col = tc;
            b.row = tr;
            b.dir = d;
            const np = `${tc},${tr}`;
            occupied.add(np);
            vacatedTo.set(myPos, np);
            return;
          }
        }
      });

      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div aria-hidden="true" className="hero-grid-boxes" ref={containerRef}>
      {blocks.map((b) => (
        <Block
          col={b.col}
          hovered={hoveredId === b.id}
          key={b.id}
          label={b.label}
          onClick={() => handleBlockClick(b.id)}
          onMouseEnter={() => handleBlockHover(b.id)}
          onMouseLeave={handleBlockLeave}
          row={b.row}
          stopped={b.stopped}
        />
      ))}
    </div>
  );
}
