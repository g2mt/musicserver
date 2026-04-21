import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createContext, useContext } from "react";

import "./ConfirmBox.css";

interface ConfirmBoxState {
  remove: () => void;
}

export const ConfirmBoxContext = createContext<ConfirmBoxState>({
  remove: () => {},
});

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
  const c = useContext(ConfirmBoxContext)!;
  return (
    <div className="confirm-box">
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
            c.remove();
          }}
        >
          Yes
        </button>
        <button
          className="btn"
          onClick={() => {
            onDecline && onDecline();
            c.remove();
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default ConfirmBox;
