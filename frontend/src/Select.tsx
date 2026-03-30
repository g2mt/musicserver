import React, { useRef } from "react";
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

type SelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

export function Select({ value, onChange, children }: SelectProps) {
  const selectRef = useRef<HTMLButtonElement | null>(null);

  const options = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === Option,
  );

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    showContextMenu(
      e.currentTarget,
      <>
        {options.map((option, index) => {
          if (!React.isValidElement(option)) return null;
          return React.cloneElement(option as React.ReactElement<OptionProps>, {
            key: index,
            onClick: () => {
              const optionValue = (option as React.ReactElement<OptionProps>).props.value;
              const syntheticEvent = {
                target: { value: String(optionValue) },
                preventDefault: () => {},
              } as unknown as React.ChangeEvent<HTMLSelectElement>;
              onChange(syntheticEvent);
            },
          });
        })}
      </>,
    );
  };

  const displayValue = value || (options[0] ? (options[0] as React.ReactElement<OptionProps>).props.children : "limit");

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
