import { useRef, useState } from 'react';
import './ImageDropZone.css';

export default function ImageDropZone({ onImageLoad, label = 'Drop image here or click to upload' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => onImageLoad(img, file.name);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      className={`drop-zone ${dragging ? 'dragging' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        loadFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="dz-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 4v14M8 10l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 20v2a2 2 0 002 2h16a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="dz-label">{label}</p>
      <p className="dz-hint">PNG, WEBP, BMP — lossless formats only</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/bmp"
        style={{ display: 'none' }}
        onChange={e => loadFile(e.target.files[0])}
      />
    </div>
  );
}
