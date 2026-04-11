import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type IconDefinition } from "@fortawesome/fontawesome-svg-core";

type ContextMenuState = {
  anchor: HTMLElement;
  content: React.ReactNode;
} | null;

let setMenuState: ((state: ContextMenuState) => void) | null = null;

/*
  Usage:

  toggleContextMenu(anchorElement, (
    <>
      <ContextMenuItem onClick=...>1</ContextMenuItem>
      <ContextMenuItem onClick=...>2</ContextMenuItem>
    </>
  ))
 */
export function toggleContextMenu(
  anchor: HTMLElement,
  content: React.ReactNode,
) {
  setMenuState?.({ anchor, content });
}

export function ContextMenuItem({
  onClick,
  icon,
  children,
  disabled,
  highlighted,
}: {
  onClick?: () => boolean | void;
  icon?: IconDefinition;
  children: React.ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`menu-item
        ${disabled ? "disabled" : ""}
        ${highlighted ? "highlighted" : ""}`}
      onClick={() => {
        if (!onClick) {
          setMenuState?.(null);
          return;
        }
        const result = onClick();
        if (result === undefined || result === true) {
          setMenuState?.(null);
        }
      }}
    >
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
    </div>
  );
}

export function ContextMenu() {
  const [state, setState] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuState = (newState: ContextMenuState) => {
      if (state !== null && state?.anchor === newState?.anchor) {
        setState(null);
        return;
      }
      setState(newState);
    };
    return () => {
      setMenuState = null;
    };
  }, [state]);

  useEffect(() => {
    if (!state) return;

    function handleClick(e: MouseEvent) {
      if (state?.anchor.contains(e.target as Node)) {
        return; // prevent double click
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setState(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setState(null);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state]);

  if (!state) return null;

  const anchorRect = state.anchor.getBoundingClientRect();
  const menuHeight = menuRef.current?.offsetHeight ?? 200;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const showAbove = spaceBelow < menuHeight && anchorRect.top > spaceBelow;

  const style: React.CSSProperties = {
    left: anchorRect.left,
    ...(showAbove
      ? {
          bottom: window.innerHeight - anchorRect.top,
          marginBottom: "var(--s2)",
        }
      : { top: anchorRect.bottom, marginTop: "var(--s2)" }),
  };

  return (
    <div className="menu" style={style} ref={menuRef}>
      {state.content}
    </div>
  );
}
