/**
 * Brand lockup. The mark is a plate seen head on: a heavy ring, a loaded hub,
 * and the bar ends poking out either side. It reads as an O for Otto and as a
 * weight on the bar at the same time, which is the whole idea.
 */
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" focusable="false">
          <circle cx="14" cy="14" r="10.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
          <circle cx="14" cy="14" r="4.4" fill="currentColor" />
          <path
            d="M0.9 14h4.4M22.7 14h4.4"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="brand-text">
        <span className="wordmark">otto</span>
        <span className="brand-sub">fitness</span>
      </span>
    </div>
  );
}
