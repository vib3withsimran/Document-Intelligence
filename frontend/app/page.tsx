'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = target;
    if (start === end) return;

    const totalMiliseconds = duration;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / 50), 15);
    const steps = totalMiliseconds / incrementTime;
    const increment = Math.ceil((end - start) / steps);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function Landing() {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [stats, setStats] = useState({ documents: 0, pages: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/documents`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const completed = data.filter((d: any) => d.status === 'completed');
          const docsCount = completed.length;
          const pagesCount = completed.reduce((sum: number, d: any) => {
            // Read from parsed_data total_pages or pages list length
            const pages = d.parsed_data?.total_pages || d.parsed_data?.pages?.length || 0;
            return sum + pages;
          }, 0);
          setStats({ documents: docsCount, pages: pagesCount });
        }
      })
      .catch(err => console.error("Failed to fetch landing stats", err))
      .finally(() => setIsStatsLoading(false));
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Redirect to upload page for files processing
    router.push('/upload');
  };

  return (
    <main className="ml-64 pt-16 min-h-screen hero-gradient bg-background relative overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-8 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4.5 py-2 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs mb-8 font-extrabold uppercase tracking-wider shadow-sm animate-pulse">
            <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            Introducing DocPulse v4.0 with Advanced RAG
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-[44px] text-on-surface mb-6 max-w-3xl mx-auto font-extrabold tracking-tight leading-[1.15]">
            Turn Raw Unstructured Data Into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#bca1ff] to-tertiary">
              Actionable Intelligence
            </span>
          </h2>
          <p className="text-base sm:text-lg text-on-surface-variant mx-auto mb-4 leading-relaxed font-medium">
            The enterprise-grade document processing engine. Automate extraction, classification, and reasoning with over 99% accuracy across millions of documents.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => router.push('/upload')}
          className={`glass-panel rounded-2xl p-1 mb-12 border transition-all duration-300 group cursor-pointer relative overflow-hidden ${isDragOver
              ? 'border-primary shadow-lg shadow-primary/10 scale-[1.01]'
              : 'border-outline-variant/35 bg-surface-container/30 hover:bg-surface-container/50 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5'
            }`}
          id="dropzone"
        >
          <div className="absolute inset-0 opacity-10 group-hover:opacity-20 pointer-events-none transition-opacity bg-gradient-to-tr from-primary via-transparent to-tertiary"></div>
          <div className="upload-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center relative z-10 transition-all duration-300 group-hover:bg-primary/5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-md">
              <span className="material-symbols-outlined text-primary text-3xl font-bold">cloud_upload</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2 tracking-tight">Drag &amp; Drop Documents</h3>
            <p className="text-on-surface-variant/80 mb-8 text-sm leading-relaxed">
              Support for PDF, DOCX, PNG, and scanned TIFF files. Large files up to 50MB supported.
            </p>
            <button className="bg-primary text-on-primary font-extrabold px-8 py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-xl font-bold">upload_file</span>
              Browse Files
            </button>
            <div className="mt-8 flex gap-6 text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">
              <span className="flex items-center gap-1"><span className="w-1 h-1 bg-tertiary rounded-full"></span> OCR Ready</span>
              <span className="w-1 h-1 bg-outline-variant/60 rounded-full self-center"></span>
              <span className="flex items-center gap-1"><span className="w-1 h-1 bg-primary rounded-full"></span> PII Protected</span>
              <span className="w-1 h-1 bg-outline-variant/60 rounded-full self-center"></span>
              <span className="flex items-center gap-1"><span className="w-1 h-1 bg-secondary rounded-full"></span> GPU Accelerated</span>
            </div>
          </div>
        </div>

        {/* Stats Counter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="glass-panel p-6 rounded-xl flex items-center justify-between group bg-[#1d2027]/40">
            <div className="space-y-1">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Documents Processed</p>
              <h4 className="text-4xl text-on-surface font-bold">
                {!isStatsLoading ? <AnimatedCounter target={stats.documents} /> : '0'}
              </h4>
            </div>
            <div className="w-12 h-12 bg-tertiary/10 text-tertiary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">task</span>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-xl flex items-center justify-between group bg-[#1d2027]/40">
            <div className="space-y-1">
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">Pages Indexed</p>
              <h4 className="text-4xl text-on-surface font-bold">
                {!isStatsLoading ? <AnimatedCounter target={stats.pages} /> : '0'}
              </h4>
            </div>
            <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">filter_none</span>
            </div>
          </div>
        </div>

        {/* Feature Cards (Bento Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-8 rounded-2xl group hover:-translate-y-1 transition-all duration-300 bg-[#1d2027]/30">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
              <span className="material-symbols-outlined text-2xl">architecture</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-3">Smart Parsing</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Go beyond OCR. Our LLM-powered parser understands layout, tables, and nested structures with structural awareness.
            </p>
            <Link href="/upload" className="text-primary font-bold flex items-center gap-2 group-hover:gap-3 transition-all text-sm">
              Learn more <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="glass-panel p-8 rounded-2xl group hover:-translate-y-1 transition-all duration-300 bg-[#1d2027]/30">
            <div className="w-12 h-12 bg-tertiary/10 rounded-xl flex items-center justify-center text-tertiary mb-6">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-3">AI Classification</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Automatically tag and categorize incoming streams of documents based on semantic content and visual signatures.
            </p>
            <Link href="/upload" className="text-tertiary font-bold flex items-center gap-2 group-hover:gap-3 transition-all text-sm">
              Learn more <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="glass-panel p-8 rounded-2xl group hover:-translate-y-1 transition-all duration-300 bg-[#1d2027]/30">
            <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary mb-6">
              <span className="material-symbols-outlined text-2xl">security</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-3">Secure RAG</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Chat with your entire repository. Private, encrypted, and isolated vector embeddings ensure your data never leaves your VPC.
            </p>
            <Link href="/chat" className="text-secondary font-bold flex items-center gap-2 group-hover:gap-3 transition-all text-sm">
              Learn more <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
