import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './ConfirmBox.css';
import { useRef } from 'react';

interface ConfirmBoxProps {
  children: React.ReactNode;
  onAccept?: () => void;
  onDecline?: () => void;
}

function ConfirmBox({ children, onAccept, onDecline }: ConfirmBoxProps) {
  const elRef = useRef<HTMLElement|null>(null);
  function remove() {
    elRef.current?.remove();
  }
  return (
    <div className="confirm-box" ref={elRef}>
      <div className="confirm-title">
        <FontAwesomeIcon icon={faCircleQuestion} /> Confirm
      </div>
      <div className="confirm-content">
        {children}
      </div>
      <div className="confirm-buttons">
        <button className="btn" onClick={() => {onAccept && onAccept(); remove();}}>Yes</button>
        <button className="btn" onClick={() => {onDecline && onDecline(); remove();}}>No</button>
      </div>
    </div>
  );
}

export default ConfirmBox;
