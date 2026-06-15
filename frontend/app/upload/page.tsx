'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface IngestedFile {
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  filename: string;
  classification?: {
    document_type?: string;
    sensitivity?: string;
    has_tables?: boolean;
    topics?: string[];
    language?: string;
  };
  error?: string;
}

export default function UploadCenter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');

  // Simulated progress percents for processing files
  const [simulatedProgress, setSimulatedProgress] = useState<Record<string, number>>({});

  // List of all uploaded files
  const [documents, setDocuments] = useState<IngestedFile[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);

  // Toast & Confetti states
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('3 files processed successfully.');

  // Fetch all documents from backend
  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/documents`);
      setDocuments(res.data || []);
    } catch (err) {
      console.error("Failed to load documents repository", err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll status for active processing tasks and increment simulated progress
  useEffect(() => {
    const activeTasks = documents.filter(doc => doc.status === 'processing');
    if (activeTasks.length === 0) return;

    // Increment simulated progress values up to 95%
    const progressInterval = setInterval(() => {
      setSimulatedProgress(prev => {
        const next = { ...prev };
        activeTasks.forEach(task => {
          const current = next[task.task_id] || 0;
          if (current < 95) {
            next[task.task_id] = Math.min(current + Math.floor(Math.random() * 8) + 2, 95);
          }
        });
        return next;
      });
    }, 400);

    // Poll status from server
    const pollInterval = setInterval(() => {
      activeTasks.forEach(async (doc) => {
        try {
          const res = await axios.get(`${API_URL}/status/${doc.task_id}`);
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            // Set progress to 100%
            setSimulatedProgress(prev => ({
              ...prev,
              [doc.task_id]: 100
            }));

            // Trigger toast and confetti if completed
            if (res.data.status === 'completed') {
              setToastMessage(`"${doc.filename}" processed successfully.`);
              setShowToast(true);
              setShowConfetti(true);
              setTimeout(() => {
                setShowConfetti(false);
              }, 4000);
            }

            // Refresh layout list
            fetchDocuments();
          }
        } catch (err) {
          console.error("Failed to poll status for", doc.task_id, err);
        }
      });
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(pollInterval);
    };
  }, [documents]);

  const handleUploadSubmit = async (fileToUpload: File) => {
    if (!fileToUpload) return;
    setIsUploading(true);
    setUploadProgressMsg('Uploading file to secure server...');

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { task_id } = res.data;

      // Optimistically add to state
      setDocuments(prev => [
        {
          task_id,
          status: 'processing',
          filename: fileToUpload.name
        },
        ...prev
      ]);

      setSimulatedProgress(prev => ({ ...prev, [task_id]: 5 }));
      setUploadProgressMsg('Upload successful! Processing document...');
      setSelectedFile(null);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgressMsg('');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setUploadProgressMsg(`Upload failed: ${err.response?.data?.detail || err.message}`);
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadSubmit(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadSubmit(e.target.files[0]);
    }
  };

  const getSensitivityColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'public': return 'bg-tertiary/10 text-tertiary border-tertiary/20';
      case 'confidential': return 'bg-error/10 text-error border-error/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <span className="material-symbols-outlined text-error text-2xl">picture_as_pdf</span>;
      case 'png':
      case 'jpg':
      case 'jpeg': return <span className="material-symbols-outlined text-primary text-2xl">image</span>;
      case 'csv': return <span className="material-symbols-outlined text-tertiary text-2xl">table_chart</span>;
      default: return <span className="material-symbols-outlined text-secondary text-2xl">description</span>;
    }
  };

  const handleSampleDownload = (filename: string) => {
    setToastMessage(`Downloading mockup file: "${filename}"`);
    setShowToast(true);
  };

  const activeUploads = documents.filter(d => d.status === 'processing');
  const finishedDocs = documents.filter(d => d.status !== 'processing');

  return (
    <main className="ml-64 pt-24 pb-16 px-8 min-h-screen relative overflow-hidden bg-background">
      {/* Background Radial Glow */}
      <div className="absolute -top-64 -right-64 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-tertiary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* Header Section */}
        <section className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-2xl font-bold">cloud_upload</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-1">Upload Documents</h2>
            <p className="text-sm font-medium text-on-surface-variant/80">Intelligent document parsing and data classification engine.</p>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Upload Area */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="glass-panel rounded-2xl p-1 mb-2 border border-outline-variant/35 bg-surface-container/30 hover:bg-surface-container/50 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-10 group-hover:opacity-15 pointer-events-none bg-gradient-to-tr from-primary to-transparent"></div>
              <div className="upload-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center relative z-10 transition-all duration-300 group-hover:bg-primary/5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.txt"
                />
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 shadow-md">
                  <span className="material-symbols-outlined text-primary text-3xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                    cloud_upload
                  </span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-2 tracking-tight">Drag and drop files here</h3>
                <p className="text-sm text-on-surface-variant/85 mb-8 text-center leading-relaxed">
                  Support for PDF, JPG, PNG, and DOCX files. Multiple file uploads are processed concurrently.
                </p>
                <button className="bg-primary text-on-primary font-extrabold px-6 py-3 rounded-xl shadow-md shadow-primary/20 hover:shadow-primary/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                  Browse Files
                </button>
              </div>
            </div>

            {uploadProgressMsg && (
              <div className="bg-[#1d2027] p-4 rounded-xl border border-primary/30 text-xs text-primary animate-pulse">
                {uploadProgressMsg}
              </div>
            )}

            {/* Processing Queue */}
            {activeUploads.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Active Uploads ({activeUploads.length})
                </h4>
                <div className="space-y-2">
                  {activeUploads.map((doc) => {
                    const prog = simulatedProgress[doc.task_id] || 5;
                    let stepName = 'Queued';
                    if (prog > 15 && prog <= 50) stepName = 'Parsing';
                    else if (prog > 50 && prog <= 85) stepName = 'Classifying';
                    else if (prog > 85) stepName = 'Indexing';

                    return (
                      <div key={doc.task_id} className="glass-panel p-4 rounded-xl border border-outline-variant flex items-start gap-4 bg-[#1d2027]/65">
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getFileIcon(doc.filename)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-on-surface truncate pr-2 font-bold">{doc.filename}</span>
                            <span className="text-tertiary text-xs font-semibold whitespace-nowrap">{stepName} ({prog}%)</span>
                          </div>
                          <div className="progress-line mb-2">
                            <div className="progress-inner bg-tertiary" style={{ width: `${prog}%` }}></div>
                          </div>
                          <div className="flex items-center gap-6 text-[10px] text-on-surface-variant">
                            <div className="flex items-center gap-1 text-tertiary">
                              <span className="material-symbols-outlined text-sm">check_circle</span> Queued
                            </div>
                            <div className={`flex items-center gap-1 ${prog > 15 ? 'text-tertiary' : 'text-outline'}`}>
                              <span className="material-symbols-outlined text-sm">
                                {prog > 15 ? 'check_circle' : 'circle'}
                              </span>{' '}
                              Parsing
                            </div>
                            <div className={`flex items-center gap-1 ${prog > 50 ? 'text-tertiary' : 'text-outline'}`}>
                              <span className="material-symbols-outlined text-sm">
                                {prog > 50 ? 'check_circle' : 'circle'}
                              </span>{' '}
                              Classifying
                            </div>
                            <div className={`flex items-center gap-1 ${prog > 85 ? 'text-primary animate-pulse' : 'text-outline'}`}>
                              <span className="material-symbols-outlined text-sm">
                                {prog > 85 ? 'sync' : 'circle'}
                              </span>{' '}
                              Indexing
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document Repository */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Ingested Repository ({finishedDocs.length})
                </h4>
                <button onClick={fetchDocuments} className="text-primary text-xs font-bold hover:underline">
                  Refresh List
                </button>
              </div>

              {isLoadingDocs ? (
                <div className="text-center py-20 text-sm text-[#c2c6d6]/60">
                  Loading repository index...
                </div>
              ) : finishedDocs.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#424754]/50 rounded-xl bg-[#1d2027]/20">
                  <p className="text-sm text-[#c2c6d6]/60 font-semibold">No files ingested yet.</p>
                  <p className="text-xs text-[#c2c6d6]/40 mt-1">Upload files above to start building your intelligence context.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {finishedDocs.map((doc) => (
                    <div key={doc.task_id} className="glass-panel p-4 rounded-xl border border-outline-variant flex items-start gap-4 bg-[#1d2027]/60">
                      <div className="w-10 h-10 rounded bg-[#10131a] border border-outline-variant/30 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(doc.filename)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span className="text-sm text-on-surface font-bold truncate pr-2">{doc.filename}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.status === 'completed' && (
                              <span className="text-[10px] bg-tertiary/10 text-tertiary border border-tertiary/20 px-2 py-0.5 rounded-full font-bold">
                                Ready
                              </span>
                            )}
                            {doc.status === 'failed' && (
                              <span className="text-[10px] bg-error/10 text-error border border-error/20 px-2 py-0.5 rounded-full font-bold">
                                Failed
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-mono truncate mb-2">Job ID: {doc.task_id}</p>

                        {/* Metadata Tags */}
                        {doc.status === 'completed' && doc.classification && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] bg-[#10131a] border border-outline-variant text-on-surface px-2 py-0.5 rounded font-semibold">
                              🗂️ {doc.classification.document_type || 'other'}
                            </span>
                            <span className={`text-[10px] border px-2 py-0.5 rounded font-semibold ${getSensitivityColor(doc.classification.sensitivity)}`}>
                              🛡️ {doc.classification.sensitivity || 'internal'}
                            </span>
                            {doc.classification.has_tables && (
                              <span className="text-[10px] bg-[#571bc1]/20 border border-[#571bc1]/40 text-[#d0bcff] px-2 py-0.5 rounded font-semibold">
                                📊 Tables
                              </span>
                            )}
                            {doc.classification.topics && doc.classification.topics.map((topic, ti) => (
                              <span key={ti} className="text-[9px] bg-surface-container-highest/60 text-on-surface-variant border border-outline-variant/50 px-1.5 py-0.5 rounded">
                                #{topic}
                              </span>
                            ))}
                          </div>
                        )}

                        {doc.status === 'failed' && (
                          <div className="text-xs text-error font-semibold italic">
                            Error: {doc.error || 'Parsing failed'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Samples & Recent */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Stats Card */}
            <div className="glass-panel rounded-2xl p-6 border border-outline-variant overflow-hidden relative bg-[#1d2027]/50">
              <div className="absolute inset-0 opacity-20 pointer-events-none"></div>
              <h4 className="text-xs font-bold text-on-surface mb-4 relative z-10 uppercase tracking-wider">AI Performance</h4>
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Accuracy</span>
                  <span className="text-tertiary font-bold">99.8%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Process Time</span>
                  <span className="text-on-surface font-semibold">~2.4s / doc</span>
                </div>
              </div>
            </div>

            {/* Sample Documents */}
            <div className="glass-panel rounded-2xl p-6 border border-outline-variant bg-[#1d2027]/40">
              <h4 className="text-xs font-bold text-on-surface mb-4 uppercase tracking-widest">Sample Documents</h4>
              <div className="space-y-2">
                <div
                  onClick={() => handleSampleDownload('invoice_june.pdf')}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-error">picture_as_pdf</span>
                    <span className="text-sm text-on-surface truncate font-semibold">invoice_june.pdf</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                </div>
                <div
                  onClick={() => handleSampleDownload('quarterly_report.docx')}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary">description</span>
                    <span className="text-sm text-on-surface truncate font-semibold">quarterly_report.docx</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                </div>
                <div
                  onClick={() => handleSampleDownload('payroll_data.csv')}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-tertiary">table_chart</span>
                    <span className="text-sm text-on-surface truncate font-semibold">payroll_data.csv</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-6 rounded-2xl bg-primary-container/10 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2 font-bold">
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                <span className="text-sm font-semibold">AI Insights</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-4 leading-normal">
                Our model has detected 14 recurring entity types in your last batch.
              </p>
              <button
                onClick={() => {
                  setToastMessage("Simulating Schema Review: Validating 14 extracted entities.");
                  setShowToast(true);
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary-container font-semibold ai-pulse hover:brightness-110 active:scale-[0.98] transition-all text-sm"
              >
                Review Schema
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      <div
        className={`fixed bottom-6 right-6 glass-panel p-4 rounded-xl border border-tertiary/30 flex items-center gap-4 shadow-2xl z-[100] transform transition-transform duration-500 bg-[#1d2027]/90 ${showToast ? 'translate-y-0' : 'translate-y-[200px]'
          }`}
      >
        <div className="w-10 h-10 rounded-full bg-tertiary/20 flex items-center justify-center text-tertiary flex-shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <div className="min-w-0 pr-4">
          <h5 className="text-sm font-bold text-on-surface">Action Completed</h5>
          <p className="text-xs text-on-surface-variant truncate">{toastMessage}</p>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface ml-auto flex-shrink-0" onClick={() => setShowToast(false)}>
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Confetti Container */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[99]">
          {Array.from({ length: 50 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 0.5;
            const duration = Math.random() * 2 + 1;
            const colors = ['#adc6ff', '#d0bcff', '#4edea3', '#ffb4ab'];
            const backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${left}vw`,
                  backgroundColor,
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

