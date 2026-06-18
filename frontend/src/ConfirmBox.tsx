import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createContext, useContext } from "react";

import { AppContext } from "src/AppState";

import "./ConfirmBox.css";

interface ConfirmBoxState {
  index: number;
}

export const ConfirmBoxContext = createContext<ConfirmBoxState>({
  index: -1,
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
  const cc = useContext(ConfirmBoxContext)!;
  const ac = useContext(AppContext)!;
  const remove = () => ac.removeConfirmBox(cc.index);

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
