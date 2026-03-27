import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import "./ContextMenu.css";

export function ContextMenuItem({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: IconDefinition;
  children: React.ReactNode;
}) {
  return (
    <div className="context-menu-item" onClick={onClick}>
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
    </div>
  );
}

type ContextMenuState = {
  anchor: HTMLElement;
  content: React.ReactNode;
} | null;

let setMenuState: ((state: ContextMenuState) => void) | null = null;

/*
  Usage:

  showContextMenu(anchorElement, (
    <>
      <ContextMenuItem onClick=...>1</ContextMenuItem>
      <ContextMenuItem onClick=...>2</ContextMenuItem>
    </>
  ))
 */
export function showContextMenu(
  anchor: HTMLElement,
  content: React.ReactNode,
) {
  setMenuState?.({ anchor, content });
}

export function ContextMenu() {
  const [state, setState] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuState = setState;
    return () => {
      setMenuState = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;

    function handleClick(e: MouseEvent) {
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
      ? { bottom: window.innerHeight - anchorRect.top }
      : { top: anchorRect.bottom }),
  };

  return (
    <div className="context-menu" style={style} ref={menuRef}>
      {state.content}
    </div>
  );
}
