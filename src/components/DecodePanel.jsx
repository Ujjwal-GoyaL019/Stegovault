import { useState, useRef, useCallback } from 'react';
import ImageDropZone from './ImageDropZone';
import PasswordInput from './PasswordInput';
import ProgressBar from './ProgressBar';
import { decodeMessage } from '../crypto';
import './Panel.css';

export default function DecodePanel() {
  const [imgSrc, setImgSrc]     = useState(null);
  const [imgDims, setImgDims]   = useState(null);
  const [password, setPassword] = useState('');
  const [result, setResult]     = useState(null);
  const [status, setStatus]     = useState(null);
  const [progress, setProgress] = useState(null);
  const [copied, setCopied]     = useState(false);
  const imgRef = useRef(null);

  const handleImageLoad = useCallback((img) => {
    setImgSrc(img.src);
    setImgDims({ w: img.width, h: img.height });
    setResult(null);
    setStatus(null);
    imgRef.current = img;
  }, []);

  const handleDecode = useCallback(async () => {
    if (!imgRef.current) return setStatus({ type: 'error', msg: 'Please upload an encoded image.' });
    if (!password)       return setStatus({ type: 'error', msg: 'Password is required.' });

    setStatus(null);
    setResult(null);
    setProgress({ pct: 5, label: 'Starting...' });

    try {
      const canvas = document.createElement('canvas');
      canvas.width  = imgRef.current.width;
      canvas.height = imgRef.current.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const msg = await decodeMessage(
        imageData, password,
        (label, pct) => setProgress({ pct, label })
      );

      setResult(msg);
      setProgress(null);
      setStatus({ type: 'success', msg: 'Message revealed successfully!' });
    } catch (err) {
      setProgress(null);
      setStatus({ type: 'error', msg: err.message });
    }
  }, [password]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  return (
    <div className="panel">
      {/* Left column */}
      <div className="panel-col">
        <section className="card">
          <h2 className="card-title">
            <span className="step-num">01</span>Upload Encoded Image
          </h2>
          <ImageDropZone onImageLoad={handleImageLoad} label="Drop the encoded PNG here or click to upload" />
          {imgDims && (
            <div className="img-meta">
              <span className="meta-chip">{imgDims.w} × {imgDims.h}px</span>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">
            <span className="step-num">02</span>Password
          </h2>
          <PasswordInput value={password} onChange={setPassword} placeholder="Decryption password" />
          <p className="hint-text">Use the exact password used during encoding.</p>
        </section>

        <button
          className="action-btn"
          onClick={handleDecode}
          disabled={!!progress}
        >
          {progress ? 'Working...' : '↑ Reveal Hidden Message'}
        </button>

        {progress && <ProgressBar progress={progress.pct} label={progress.label} />}

        {status && (
          <div className={`alert ${status.type}`}>
            {status.type === 'success' ? '✓' : '✕'} {status.msg}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="panel-col preview-col">
        <section className="card preview-card">
          <h2 className="card-title">Preview</h2>
          {imgSrc ? (
            <img src={imgSrc} alt="Encoded" className="preview-img" />
          ) : (
            <div className="preview-placeholder">
              <span>Encoded image preview</span>
            </div>
          )}
        </section>

        {result !== null && (
          <section className="card result-message-card">
            <div className="result-header">
              <h2 className="card-title result-title">
                <span className="success-dot" aria-hidden="true" />
                Revealed Message
              </h2>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="message-output">{result}</div>
          </section>
        )}
      </div>
    </div>
  );
}
