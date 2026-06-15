'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Citation {
  document: string;
  page: number;
  relevance: number;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  time: string;
  citations?: Citation[];
}

interface IngestedFile {
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  filename: string;
  classification?: {
    document_type?: string;
    sensitivity?: string;
  };
}

export default function ChatAssistant() {
  const [documents, setDocuments] = useState<IngestedFile[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);

  // Chat states
  const [question, setQuestion] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'bot',
      text: "Hello Alex. I've finished indexing the document intelligence sources. How can I assist with your document analysis today?",
      time: '10:42 AM',
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/documents`);
      setDocuments(res.data || []);
    } catch (err) {
      console.error("Failed to load documents for chat panel", err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isChatLoading) return;

    const userMsg = question;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setQuestion('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg, time: timeStr }]);
    setIsChatLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, null, {
        params: { query: userMsg }
      });

      const respTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.answer,
          time: respTime,
          citations: res.data.citations || []
        }
      ]);
    } catch (err: any) {
      console.error(err);
      const respTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: 'Error: Could not retrieve an answer from the RAG agent. Ensure your backend server is running and your Groq API key is valid.',
          time: respTime
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getCitationImage = (index: number) => {
    // Alternating between Stitch photo mockups for visual beauty
    const urls = [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAdObQ6B0-b0Zw2mzI7DvACeAqm2k4-1qB1_hwJcwRBBK-jS5zpWLJIDrO-0qKTecZotFEV1b3RodecawT4SlfB1r9o5jHS2o6SWOo-3CkS34qjwAOkRsOXGh7s_NqTFW9RA41Ea7TfH-GeDA5hFUqGNPJzQmUTAGqyB82T6U2QSpeXFu2w9YlNWpzi2WZR4lxIsiEAiostREJFGVvrqWvbI9hfV7QOcc4cNzwV_GRdPejHcT4yV9Gb_cwu8EScFD8AK63j4poBJ6k",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCHWj0GM8ix8Ybw__2wMmb5MV-P8PTPC4wXu99_RcRNjG4yw_MppfYXK130qG2IiebsOGnRPi632IMvFqaQ1Iwp8BGZDkSoFKs4OpIy3Ryc-jGOqXWRwCEctKRtdWF2ISSkSGvqilhVRmNrnMW7yvNoBbl9evn4xxTR4BZ_Yleg76mWQhkiYCGGfwLOaEtK7AQPFkTP9Zz2c30UCfUVWYsv-Y-EZ3MoupYBhsYvCCz9rq_qo9i-nymR7ydBNPfOK-_EZjNIusGiogE"
    ];
    return urls[index % urls.length];
  };

  const completedDocs = documents.filter(d => d.status === 'completed');
  const contextPct = Math.min(completedDocs.length * 10, 100);

  return (
    <main className="pt-16 pl-64 h-screen flex overflow-hidden bg-background">
      {/* SIDEBAR: Document List (30%) */}
      <section className="w-1/3 min-w-[320px] bg-surface-container-low border-r border-outline-variant/20 flex flex-col h-full">
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <h2 className="font-headline-sm text-headline-sm font-bold mb-md text-on-surface">Context Files</h2>
          
          {isLoadingDocs ? (
            <div className="flex-1 flex items-center justify-center text-xs text-on-surface-variant/40">
              Loading files list...
            </div>
          ) : documents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#424754]/30 rounded-xl">
              <p className="text-xs text-on-surface-variant/50">No documents ingested.</p>
              <Link href="/upload" className="text-[11px] text-primary hover:underline mt-2">
                Go upload files first →
              </Link>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-sm pr-1 scrollbar-thin min-h-0">
              {documents.map((doc, idx) => {
                const isActive = doc.status === 'completed';
                return (
                  <div
                    key={doc.task_id}
                    className={`p-md rounded-xl border transition-all cursor-default ${
                      isActive
                        ? 'bg-[#1d2027]/70 border-primary/20 hover:border-primary/50'
                        : 'bg-surface-container-highest/20 border-outline-variant/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-md min-w-0">
                      <div className={`w-10 h-12 rounded flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}>
                          description
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-label-md font-bold text-on-surface truncate leading-tight mb-xs" title={doc.filename}>
                          {doc.filename}
                        </h3>
                        <div className="flex items-center gap-xs">
                          {doc.status === 'completed' && (
                            <span className="text-[10px] text-tertiary flex items-center gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Ready
                            </span>
                          )}
                          {doc.status === 'processing' && (
                            <span className="text-[10px] text-primary flex items-center gap-1 font-semibold animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Parsing
                            </span>
                          )}
                          {doc.status === 'failed' && (
                            <span className="text-[10px] text-error flex items-center gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Failed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Context Limit Progress */}
        <div className="mt-auto p-lg bg-[#272a31]/20 border-t border-[#424754]/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-sm">
            <span className="text-label-sm text-outline font-semibold">Context Limit</span>
            <span className="text-label-sm text-primary font-bold">{contextPct}% Full</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${contextPct}%` }}></div>
          </div>
        </div>
      </section>

      {/* CHAT AREA (70%) */}
      <section className="flex-1 flex flex-col relative h-full">
        {/* Chat Header */}
        <div className="bg-[#0b0e15]/40 px-6 py-4 border-b border-[#424754]/40 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
            <span className="text-sm font-bold text-on-surface">PulseAssistant</span>
          </div>
          <span className="text-xs text-on-surface-variant/40 font-medium">Active session connected</span>
        </div>

        {/* Chat History */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-lg space-y-xl z-10 relative scrollbar-thin bg-slate-900/10 min-h-0"
        >
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-lg max-w-4xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Profile Avatar */}
              <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-lg ${
                msg.sender === 'user' ? 'bg-primary-container text-on-primary-container' : 'bg-tertiary-container text-on-tertiary'
              }`}>
                <span className="material-symbols-outlined font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {msg.sender === 'user' ? 'person' : 'bolt'}
                </span>
              </div>

              {/* Message Content Bubble */}
              <div className={`space-y-md ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`p-lg rounded-2xl shadow-xl ${
                  msg.sender === 'user'
                    ? 'bg-primary-container text-on-primary-container rounded-tr-none'
                    : 'glass-panel text-on-surface rounded-tl-none bg-[#1d2027]/80'
                }`}>
                  <p className="text-body-md leading-relaxed whitespace-pre-line">{msg.text}</p>

                  {/* Expandable Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-md border-t border-[#424754]/30 pt-md text-left">
                      <details className="group" open>
                        <summary className="flex items-center gap-sm text-primary font-label-md cursor-pointer list-none select-none font-bold">
                          <span className="material-symbols-outlined group-open:rotate-90 transition-transform text-sm">chevron_right</span>
                          <span>Show {msg.citations.length} Source{msg.citations.length > 1 ? 's' : ''}</span>
                        </summary>
                        <div className="mt-md flex gap-lg overflow-x-auto pb-sm scrollbar-thin">
                          {msg.citations.map((cite, cIdx) => (
                            <div key={cIdx} className="flex-shrink-0 w-[180px]">
                              <div className="h-[220px] rounded-lg overflow-hidden border border-[#424754]/50 relative group/thumb cursor-zoom-in">
                                <img
                                  alt="Document thumbnail"
                                  className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                                  src={getCitationImage(cIdx)}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-100 p-sm flex flex-col justify-end">
                                  <p className="text-[10px] text-white font-bold leading-tight truncate" title={cite.document}>{cite.document}</p>
                                  <p className="text-[10px] text-primary font-semibold">
                                    Page {cite.page} • Score {(cite.relevance * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-outline px-1 block">{msg.time}</span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isChatLoading && (
            <div className="flex gap-lg max-w-4xl mr-auto">
              <div className="w-10 h-10 rounded-lg bg-tertiary-container flex-shrink-0 flex items-center justify-center opacity-50 text-on-tertiary">
                <span className="material-symbols-outlined font-bold animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
                  bolt
                </span>
              </div>
              <div className="glass-panel px-lg py-sm rounded-2xl rounded-tl-none flex items-center gap-xs bg-[#1d2027]/50">
                <div className="w-2 h-2 rounded-full bg-outline typing-dot"></div>
                <div className="w-2 h-2 rounded-full bg-outline typing-dot"></div>
                <div className="w-2 h-2 rounded-full bg-outline typing-dot"></div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-lg border-t border-[#424754]/20 bg-[#191b23]/50 backdrop-blur-xl z-20 flex-shrink-0">
          <form onSubmit={handleAskQuestion} className="max-w-4xl mx-auto relative">
            <div className="flex items-end gap-md glass-panel p-md rounded-3xl shadow-2xl bg-[#1d2027]/75">
              {/* Attach / Add icon */}
              <button
                type="button"
                className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center text-outline hover:text-primary hover:bg-surface-container-highest transition-all"
              >
                <span className="material-symbols-outlined">attach_file</span>
              </button>

              {/* Input textarea */}
              <div className="flex-1 min-h-[48px] py-md">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion(e);
                    }
                  }}
                  className="w-full bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none max-h-48 overflow-y-auto outline-none"
                  placeholder="Ask anything about your documents..."
                  rows={1}
                />
              </div>

              {/* Pulsing Mic Button */}
              <div className={`relative group ${isMicActive ? 'active' : ''}`}>
                {isMicActive && <div className="absolute inset-0 bg-primary/30 rounded-2xl ai-pulse scale-125"></div>}
                <button
                  type="button"
                  onClick={() => setIsMicActive(!isMicActive)}
                  className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-95 z-10 relative ${
                    isMicActive ? 'text-primary bg-primary/10' : 'bg-surface-container-highest text-outline hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined">mic</span>
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isChatLoading || !question.trim()}
                className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center bg-primary text-on-primary-container shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition-all active:scale-90"
              >
                <span className="material-symbols-outlined font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
              </button>
            </div>
            <p className="text-[10px] text-outline text-center mt-sm">DocPulse Intelligence can make mistakes. Verify important financial data.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
