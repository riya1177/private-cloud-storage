import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

const ImageThumbnail = ({ filename, alt, className = 'w-full h-full object-cover' }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const fetchImageBlob = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await client.get(`/download/${encodeURIComponent(filename)}`, {
          responseType: 'blob',
        });
        if (isMounted) {
          const blob = new Blob([response.data], {
            type: response.headers['content-type'] || 'image/jpeg',
          });
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Failed to load image blob for ${filename}:`, err);
          setError(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (filename) {
      fetchImageBlob();
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filename]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/90 animate-pulse ${className}`}>
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-500 ${className}`}>
        <ImageIcon className="w-6 h-6 opacity-60" />
      </div>
    );
  }

  return <img src={src} alt={alt || filename} className={className} loading="lazy" />;
};

export default ImageThumbnail;
