import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="12" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
              <rect x="1" y="12" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
              <rect x="12" y="12" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="2" fill="currentColor"/>
            </svg>
          </div>
          <span className="logo-name">StegoVault</span>
        </div>
        <div className="header-badge">
          <span className="pulse-dot" aria-hidden="true"/>
          <span>Client-side only</span>
        </div>
      </div>
    </header>
  );
}
