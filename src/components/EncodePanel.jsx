import { useState, useRef, useCallback } from 'react';
import ImageDropZone from './ImageDropZone';
import PasswordInput from './PasswordInput';
import ProgressBar from './ProgressBar';
import { encodeMessage, getCapacity } from '../crypto';
import './Panel.css';

export default function EncodePanel() {
  const [imgSrc, setImgSrc]       = useState(null);
  const [imgName, setImgName]     = useState('');
  const [imgDims, setImgDims]     = useState(null);
  const [message, setMessage]     = useState('');
  const [password, setPassword]   = useState('');
  const [status, setStatus]       = useState(null);
  const [progress, setProgress]   = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const imgRef = useRef(null);

  const handleImageLoad = useCallback((img, name) => {
    setImgSrc(img.src);
    setImgName(name);
    setImgDims({ w: img.width, h: img.height });
    setResultUrl(null);
    setStatus(null);
    imgRef.current = img;
  }, []);

  const handleEncode = useCallback(async () => {
    if (!imgRef.current) return setStatus({ type: 'error', msg: 'Please upload an image first.' });
    if (!message.trim()) return setStatus({ type: 'error', msg: 'Message cannot be empty.' });
    if (!password)       return setStatus({ type: 'error', msg: 'Password is required.' });

    setStatus(null);
    setResultUrl(null);
    setProgress({ pct: 5, label: 'Starting...' });

    try {
      const canvas = document.createElement('canvas');
      canvas.width  = imgRef.current.width;
      canvas.height = imgRef.current.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const resultImageData = await encodeMessage(
        imageData, message, password,
        (label, pct) => setProgress({ pct, label })
      );

      ctx.putImageData(resultImageData, 0, 0);
      const url = canvas.toDataURL('image/png');
      setResultUrl(url);
      setProgress(null);
      setStatus({ type: 'success', msg: 'Message hidden successfully! Download the image below.' });
    } catch (err) {
      setProgress(null);
      setStatus({ type: 'error', msg: err.message });
    }
  }, [message, password]);

  const capacity = imgDims ? getCapacity(imgDims.w, imgDims.h) : 0;
  const msgBytes = new TextEncoder().encode(message).length;
  const usedPct  = capacity ? Math.min(100, Math.round((msgBytes / (capacity * 0.85)) * 100)) : 0;

  return (
    <div className="panel">
      {/* Left column */}
      <div className="panel-col">
        <section className="card">
          <h2 className="card-title">
            <span className="step-num">01</span>Upload Image
          </h2>
          <ImageDropZone onImageLoad={handleImageLoad} />
          {imgDims && (
            <div className="img-meta">
              <span className="meta-chip">{imgDims.w} × {imgDims.h}px</span>
              <span className="meta-chip">~{(capacity / 1024).toFixed(1)} KB capacity</span>
              <span className="meta-chip ellipsis">{imgName}</span>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">
            <span className="step-num">02</span>Secret Message
          </h2>
          <textarea
            className="msg-textarea"
            placeholder="Type the message to hide inside the image..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
          />
          {imgDims && (
            <div className="capacity-bar-wrap">
              <div className="capacity-header">
                <span className="cap-label">Payload size</span>
                <span className="cap-val">{msgBytes} B / ~{Math.floor(capacity * 0.85)} B safe</span>
              </div>
              <div className="capacity-track">
                <div
                  className={`capacity-fill ${usedPct > 90 ? 'danger' : usedPct > 70 ? 'warn' : ''}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">
            <span className="step-num">03</span>Password
          </h2>
          <PasswordInput value={password} onChange={setPassword} placeholder="Encryption password" />
          <p className="hint-text">Use the same password to reveal the message later.</p>
        </section>

        <button
          className="action-btn"
          onClick={handleEncode}
          disabled={!!progress}
        >
          {progress ? 'Working...' : '↓ Hide Message in Image'}
        </button>

        {progress && <ProgressBar progress={progress.pct} label={progress.label} />}

        {status && (
          <div className={`alert ${status.type}`}>
            {status.type === 'success' ? '✓' : '✕'} {status.msg}
          </div>
        )}
      </div>

      {/* Right column — preview */}
      <div className="panel-col preview-col">
        <section className="card preview-card">
          <h2 className="card-title">Preview</h2>
          {imgSrc ? (
            <img src={imgSrc} alt="Original" className="preview-img" />
          ) : (
            <div className="preview-placeholder">
              <span>Image preview</span>
            </div>
          )}
        </section>

        {resultUrl && (
          <section className="card preview-card result-card">
            <h2 className="card-title result-title">
              <span className="success-dot" aria-hidden="true" />
              Encoded Output
            </h2>
            <img src={resultUrl} alt="Encoded" className="preview-img" />
            <a className="download-btn" href={resultUrl} download="stego_output.png">
              ↓ Download PNG
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
