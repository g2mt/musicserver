import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './ConfirmBox.css';

interface ConfirmBoxProps {
  children: React.ReactNode;
  onAccept?: () => void;
  onDecline?: () => void;
}

function ConfirmBox({ children, onAccept, onDecline }: ConfirmBoxProps) {
  return (
    <div className="confirm-box">
      <div className="confirm-title">
        <FontAwesomeIcon icon={faCircleQuestion} /> Confirm
      </div>
      <div className="confirm-content">
        {children}
      </div>
      <div className="confirm-buttons">
        <button className="btn" onClick={onAccept}>Yes</button>
        <button className="btn" onClick={onDecline}>No</button>
      </div>
    </div>
  );
}

export default ConfirmBox;
