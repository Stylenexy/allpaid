// "Watch it run itself": starts the automatic demo. Light on purpose: the demo
// itself loads only once this is pressed.
import { startDemo } from './trigger';
import './watch.css';

export function WatchButton({ className = '' }: { className?: string }) {
  return (
    <button type="button" className={`demo-watch demo-start ${className}`} onClick={startDemo}>
      <span className="demo-play" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M2.5 1.2l8 4.8-8 4.8z" />
        </svg>
      </span>
      <span>
        Watch it run itself <small>· 90 seconds</small>
      </span>
    </button>
  );
}
