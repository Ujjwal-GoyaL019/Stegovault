import './TabBar.css';

const tabs = [
  { id: 'encode', label: 'Hide Message', icon: '↓' },
  { id: 'decode', label: 'Reveal Message', icon: '↑' },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="tabbar-wrap">
      <div className="tabbar" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className={`tab-btn ${active === t.id ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
