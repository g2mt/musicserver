import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

import { ContextMenuItem, toggleContextMenu } from "src/ContextMenu";

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
  /** Callback when a new option is selected */
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** List of <Option> elements */
  children: React.ReactElement<OptionProps>[];
  /** Value of the initially selected option */
  defaultValue?: any;
  /** If true, the chevron icon is rendered on the right side of the button */
  isIconRight?: boolean;
};

export function Select({
  onChange,
  children,
  defaultValue,
  isIconRight = false,
}: SelectProps) {
  const selectedOption =
    children.find((child) => child.props.value === defaultValue) ?? children[0];

  // Extract the display content of the selected option into a variable
  const selectedContent = selectedOption ? selectedOption.props.children : "";

  const chevron = <FontAwesomeIcon icon={faChevronDown} />;

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
      {isIconRight ? (
        <>
          {selectedContent}
          {chevron}
        </>
      ) : (
        <>
          {chevron}
          {selectedContent}
        </>
      )}
    </button>
  );
}
