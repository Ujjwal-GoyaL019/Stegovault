import { useState } from 'react';
import Header from './components/Header';
import TabBar from './components/TabBar';
import EncodePanel from './components/EncodePanel';
import DecodePanel from './components/DecodePanel';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('encode');

  return (
    <div className="app">
      <div className="grid-bg" aria-hidden="true" />
      <div className="glow-orb top-left" aria-hidden="true" />
      <div className="glow-orb bottom-right" aria-hidden="true" />

      <Header />

      <main className="main">
        <TabBar active={tab} onChange={setTab} />
        <div className="panel-wrap">
          {tab === 'encode' ? <EncodePanel /> : <DecodePanel />}
        </div>
      </main>

      <footer className="footer">
        <span className="mono-tag">AES-256-CBC</span>
        <span className="sep">·</span>
        <span className="mono-tag">HMAC-SHA256</span>
        <span className="sep">·</span>
        <span className="mono-tag">PBKDF2 × 200k</span>
        <span className="sep">·</span>
        <span className="mono-tag">1-bit LSB</span>
      </footer>
    </div>
  );
}
