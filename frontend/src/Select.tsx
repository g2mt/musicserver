import React, { useState, useRef } from "react";
import { ContextMenuItem, showContextMenu } from "./ContextMenu";

type OptionProps = {
  value: string | number;
  onClick: () => void;
  children: React.ReactNode;
};

export function Option({ onClick, children }: OptionProps) {
  return (
    <ContextMenuItem onClick={onClick}>
      {children}
    </ContextMenuItem>
  );
}

type SelectMenuProps = {
  value: string | number;
  onChange: (value: string | number) => void;
  children: React.ReactNode;
};

export function SelectMenu({ value, onChange, children }: SelectMenuProps) {
  const options = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === Option,
  );

  const handleOptionClick = (optionValue: string | number) => {
    onChange(optionValue);
  };

  return (
    <>
      {options.map((option, index) => {
        if (!React.isValidElement(option)) return null;
        return React.cloneElement(option as React.ReactElement<OptionProps>, {
          key: index,
          onClick: () => handleOptionClick((option as React.ReactElement<OptionProps>).props.value),
        });
      })}
    </>
  );
}

type SelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

export function Select({ value, onChange, children }: SelectProps) {
  const selectRef = useRef<HTMLButtonElement|null>(null);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    showContextMenu(e.currentTarget, <SelectMenu value={value} onChange={(val) => {
      const syntheticEvent = {
        target: { value: String(val) },
        preventDefault: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }}>{children}</SelectMenu>);
  };

  const displayValue = value || "limit";

  return (
    <button
      className="btn menu-select"
      onClick={handleClick}
      ref={selectRef}
    >
      {displayValue}
    </button>
  );
}
