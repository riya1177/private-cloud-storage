import React from 'react';
import {
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  File,
} from 'lucide-react';

const getFileDetails = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    return { icon: FileImage, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) {
    return { icon: FileVideo, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' };
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return { icon: FileAudio, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return { icon: FileArchive, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return { icon: FileText, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
  }
  if (['csv', 'xls', 'xlsx'].includes(ext)) {
    return { icon: FileSpreadsheet, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' };
  }
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'cpp', 'c', 'java', 'sql', 'sh'].includes(ext)) {
    return { icon: FileCode, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
  }

  return { icon: File, color: 'text-slate-400 bg-slate-800/80 border-slate-700/50' };
};

const FileIcon = ({ filename = '', className = 'w-9 h-9' }) => {
  const { icon: Icon, color } = getFileDetails(filename);

  return (
    <div className={`${className} flex items-center justify-center rounded-xl border ${color} shrink-0`}>
      <Icon className="w-4 h-4" />
    </div>
  );
};

export default FileIcon;
