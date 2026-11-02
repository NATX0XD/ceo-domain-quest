"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/components/ui";

export const KIT = (name: string) => `/learn/m2/kit/${name}.webp`;

/* ── Screen shell: full-bleed scene + top row (back · wood sign · sound) ── */

export function M2Screen({
  title,
  subtitle,
  onBack,
  soundOn,
  onSound,
  tone = "day",
  children,
  footer,
  className,
  onTap,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  soundOn: boolean;
  onSound: () => void;
  tone?: "day" | "storm" | "chat";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onTap?: () => void;
}) {
  return (
    <div className={cn("m2g-screen", `tone-${tone}`, className)} onClick={onTap}>
      <div className="m2g-bg" aria-hidden />
      {tone === "storm" ? <div className="m2g-rain" aria-hidden /> : null}
      <header className="m2g-top">
        <button
          type="button"
          className="m2g-round"
          onClick={(event) => {
            event.stopPropagation();
            onBack();
          }}
          aria-label="ย้อนกลับ"
        >
          <img src={KIT("icon_back")} alt="" draggable={false} />
        </button>
        <div className="m2g-sign-col">
          <h1 className="m2g-sign">{title}</h1>
          {subtitle ? <span className="m2g-pill">{subtitle}</span> : null}
        </div>
        <button
          type="button"
          className={cn("m2g-round", !soundOn && "is-muted")}
          onClick={(event) => {
            event.stopPropagation();
            onSound();
          }}
          aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}
          aria-pressed={soundOn}
        >
          <img src={KIT("icon_sound")} alt="" draggable={false} />
        </button>
      </header>
      <main className="m2g-body">{children}</main>
      {footer ? <div className="m2g-foot">{footer}</div> : null}
    </div>
  );
}

export function M2Button({
  children,
  onClick,
  disabled,
  color = "green",
  size = "lg",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: "green" | "grey" | "red" | "blue" | "purple" | "orange" | "cream";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn("game-button", `game-button--${size}`, "m2g-btn", `is-${color}`, className)}
    >
      <span>{children}</span>
      <span className="m2g-chev" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function Dome({
  children,
  tag,
  tagTone = "yellow",
  size = "md",
  className,
  bubbleSide = "right",
}: {
  children?: ReactNode;
  tag?: string;
  tagTone?: "yellow" | "red" | "green";
  size?: "sm" | "md" | "lg";
  className?: string;
  bubbleSide?: "right" | "top";
}) {
  return (
    <div className={cn("m2g-dome", `size-${size}`, `side-${bubbleSide}`, className)}>
      <img className="m2g-dome-img" src={KIT("dome_cheer")} alt="โดม" draggable={false} />
      {children ? (
        <div className="m2g-bubble" role="status">
          {tag ? <span className={cn("m2g-bubble-tag", `tone-${tagTone}`)}>{tag}</span> : null}
          <div className="m2g-bubble-text">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  style,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={cn("m2g-panel", className)} style={style}>
      {title ? <p className="m2g-panel-title">{title}</p> : null}
      {children}
    </section>
  );
}

/* ── Real drag and drop (pointer events: mouse + touch + pen) ──────────────
 * pointerdown captures the pointer, the item follows the finger via translate,
 * the drop zone under the finger lights up, pointerup over a zone fires onDrop,
 * anywhere else springs the item back. A press without movement is a tap
 * (tap piece → tap slot fallback).
 */

type DragState = { id: string; dx: number; dy: number } | null;

export function useDragBoard(onDrop: (item: string, zone: string) => void) {
  const [drag, setDrag] = useState<DragState>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; id: string; moved: boolean } | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const zoneAt = (x: number, y: number, self: HTMLElement) => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (self.contains(element)) continue;
      const zone = (element as HTMLElement).closest?.("[data-m2-zone]") as HTMLElement | null;
      if (zone?.dataset.m2Zone) return zone.dataset.m2Zone;
    }
    return null;
  };

  const itemProps = useCallback(
    (id: string, disabled = false) => ({
      "data-m2-item": id,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (disabled || event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, y: event.clientY, id, moved: false };
        setReturning(null);
        setDrag({ id, dx: 0, dy: 0 });
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.id !== id) return;
        const dx = event.clientX - s.x;
        const dy = event.clientY - s.y;
        if (!s.moved && Math.hypot(dx, dy) > 6) s.moved = true;
        setDrag({ id, dx, dy });
        setHover(s.moved ? zoneAt(event.clientX, event.clientY, event.currentTarget) : null);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.id !== id) return;
        start.current = null;
        event.stopPropagation();
        const zone = s.moved ? zoneAt(event.clientX, event.clientY, event.currentTarget) : null;
        setDrag(null);
        setHover(null);
        if (!s.moved) {
          setSelected((current) => (current === id ? null : id));
          return;
        }
        if (zone) {
          setSelected(null);
          dropRef.current(id, zone);
        } else {
          setReturning(id);
          window.setTimeout(() => setReturning((r) => (r === id ? null : r)), 320);
        }
      },
      onPointerCancel: () => {
        start.current = null;
        setDrag(null);
        setHover(null);
      },
      onClick: (event: React.MouseEvent) => event.stopPropagation(),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelected((current) => (current === id ? null : id));
        }
      },
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-pressed": selected === id,
      "aria-disabled": disabled || undefined,
      className: cn(
        "m2g-drag",
        drag?.id === id && "is-dragging",
        returning === id && "is-returning",
        selected === id && "is-selected",
        disabled && "is-disabled",
      ),
      style: {
        touchAction: "none",
        transform:
          drag?.id === id
            ? `translate3d(${drag.dx}px, ${drag.dy}px, 0) scale(1.08) rotate(-2deg)`
            : undefined,
        zIndex: drag?.id === id ? 60 : undefined,
      } as CSSProperties,
    }),
    [drag, returning, selected],
  );

  const zoneProps = useCallback(
    (zone: string) => ({
      "data-m2-zone": zone,
      "data-hover": hover === zone || undefined,
      "data-ready": (selected !== null && hover === null) || undefined,
      onClick: (event: React.MouseEvent) => {
        event.stopPropagation();
        if (selected) {
          const item = selected;
          setSelected(null);
          dropRef.current(item, zone);
        }
      },
    }),
    [hover, selected],
  );

  return { itemProps, zoneProps, selected, setSelected, hover, dragging: drag?.id ?? null };
}

/** slot → item map where one item can only sit in one slot */
export function placeUnique(
  current: Record<string, string>,
  zone: string,
  item: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (value !== item && key !== zone) next[key] = value;
  }
  if (zone !== "tray") next[zone] = item;
  return next;
}

export function Nail() {
  return <img className="m2g-nail" src={KIT("dot_nail")} alt="" aria-hidden draggable={false} />;
}

export function Stars({ count, pop = true }: { count: number; pop?: boolean }) {
  return (
    <img
      key={count}
      className={cn("m2g-stars", pop && "is-pop")}
      src={KIT(`stars_${Math.max(0, Math.min(3, count))}`)}
      alt={`${count} ดาว`}
      draggable={false}
    />
  );
}

export function ScanArrow({ active }: { active: boolean }) {
  return (
    <div className={cn("m2g-arrow", active && "is-active")} aria-hidden>
      <span className="m2g-arrow-head" />
      <span className="m2g-arrow-bar">
        <i className="dot-green" />
        <i className="dot-blue" />
        <i className="dot-orange" />
      </span>
    </div>
  );
}
