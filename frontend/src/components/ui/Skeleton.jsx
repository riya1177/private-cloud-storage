import React from 'react';

export const Skeleton = ({ className = 'h-4 w-full rounded-lg' }) => (
  <div className={`bg-slate-200/80 dark:bg-slate-800/80 animate-pulse ${className}`} />
);

export const SkeletonFileRow = () => (
  <div className="flex items-center justify-between p-3.5 bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 rounded-xl animate-pulse">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="space-y-1.5 flex-1 max-w-xs">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
        <div className="h-3 bg-slate-200/60 dark:bg-slate-800/60 rounded w-1/2" />
      </div>
    </div>
    <div className="hidden sm:block w-24 h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded mx-4" />
    <div className="hidden md:block w-28 h-4 bg-slate-200/60 dark:bg-slate-800/60 rounded mx-4" />
    <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 shrink-0" />
  </div>
);

export const SkeletonStatCard = () => (
  <div className="p-5 bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl animate-pulse space-y-3">
    <div className="flex justify-between items-center">
      <div className="w-24 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
    </div>
    <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded" />
    <div className="w-40 h-3 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
  </div>
);

export default Skeleton;
