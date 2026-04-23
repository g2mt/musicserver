import React from "react";
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

type OptionProps = {
  value: any;
  onClick?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
};

export function Option({ onClick, children, disabled }: OptionProps) {
  const itemOnClick = (() => {
    if (disabled) return () => false;
    return onClick ?? (() => {});
  })();
  return (
    <ContextMenuItem onClick={itemOnClick} disabled={disabled}>
      {children}
    </ContextMenuItem>
  );
}

type SelectProps = {
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactElement<OptionProps>[];
  defaultValue?: any;
};

export function Select({ onChange, children, defaultValue }: SelectProps) {
  const selectedOption =
    children.find((child) => child.props.value === defaultValue) ?? children[0];

  return (
    <button
      className="btn"
      onClick={(e) => {
        toggleContextMenu(
          e.currentTarget,
          <>
            {children.map((option, index) => {
              return React.cloneElement(option, {
                key: index,
                onClick: () => {
                  const optionValue = option.props.value;
                  const syntheticEvent = {
                    target: { value: String(optionValue) },
                    preventDefault: () => {},
                  } as React.ChangeEvent<HTMLSelectElement>;
                  onChange(syntheticEvent);
                },
              });
            })}
          </>,
        );
      }}
    >
      <FontAwesomeIcon icon={faChevronDown} />
      {selectedOption ? selectedOption.props.children : ""}
    </button>
  );
}
