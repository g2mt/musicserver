import React from "react";
import { ContextMenuItem, showContextMenu } from "./ContextMenu";
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
  return <ContextMenuItem onClick={itemOnClick}>{children}</ContextMenuItem>;
}

type SelectProps = {
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactElement<OptionProps>[];
};

export function Select({ onChange, children }: SelectProps) {
  return (
    <button
      className="btn"
      onClick={(e) => {
        showContextMenu(
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
      {children.length > 0 ? children[0].props.children : ""}
    </button>
  );
}
