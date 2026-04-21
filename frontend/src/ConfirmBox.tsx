import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRef } from "react";

import "./ConfirmBox.css";

interface ConfirmBoxProps {
  children: React.ReactNode;
  onAccept?: () => void;
  onDecline?: () => void;
  titleButtons?: React.ReactNode;
}

function ConfirmBox({
  children,
  onAccept,
  onDecline,
  titleButtons,
}: ConfirmBoxProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  function remove() {
    elRef.current?.remove();
  }
  return (
    <div className="confirm-box" ref={elRef}>
      <div className="confirm-title">
        <div className="confirm-title-text">
          <FontAwesomeIcon icon={faCircleQuestion} /> Confirm
        </div>
        <div className="confirm-title-buttons">{titleButtons}</div>
      </div>
      <div className="confirm-content">{children}</div>
      <div className="confirm-buttons">
        <button
          className="btn"
          onClick={() => {
            onAccept && onAccept();
            remove();
          }}
        >
          Yes
        </button>
        <button
          className="btn"
          onClick={() => {
            onDecline && onDecline();
            remove();
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default ConfirmBox;
