'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Loader2, Gauge, BarChart3, Award, FileText, CheckCircle2, 
  Copy, Cpu, ShieldAlert, Sparkles, Activity, Clock 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Cell
} from 'recharts';
import { createMessage } from '@/app/chat/actions';


interface OcrBenchmarkModalProps {
  documentId: string;
  storagePath: string;
  documentName: string;
  chatId: string;
  onClose: () => void;
  onBenchmarkComplete?: () => void;
}

export default function OcrBenchmarkModal({
  documentId,
  storagePath,
  documentName,
  chatId,
  onClose,
  onBenchmarkComplete
}: OcrBenchmarkModalProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'charts' | 'raw'>('summary');
  const [copied, setCopied] = useState(false);

  const steps = [
    "Initializing benchmark environment...",
    "Running PyMuPDF Engine (Native Extractor)...",
    "Running Surya OCR Engine (Layout & Text OCR)...",
    "Running PaddleOCR Engine (Speed & Accuracy)...",
    "Running Tesseract OCR Engine (Standard Extractor)...",
    "Running DocTR OCR Engine (Deep Segmentation)...",
    "Auto-generating document evaluation QA...",
    "Executing RAG similarity retrieval & grading...",
    "Calculating resource efficiency & final weights...",
    "Compiling summary report..."
  ];

  // Start the benchmark run on mount
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const startBenchmark = async () => {
      setStatus('running');
      setProgressStep(0);
      
      // Animate progress steps during benchmark processing
      let currentStep = 0;
      interval = setInterval(() => {
        if (currentStep < steps.length - 1) {
          currentStep += 1;
          setProgressStep(currentStep);
        }
      }, 3500);

      try {
        const response = await fetch('/api/benchmark', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId,
            storagePath,
          }),
        });

        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.error || 'Failed to complete benchmark');
        }

        // Once benchmark is completed in python, fetch the full report and scoring details
        const resultsRes = await fetch(`/api/benchmark/${resData.benchmark_id}`);
        if (!resultsRes.ok) {
          throw new Error('Failed to retrieve benchmark scores');
        }
        
        const scoreData = await resultsRes.json();
        setData(scoreData);
        setStatus('completed');
        clearInterval(interval);

        // Auto-save a summary to the chat messages history
        await saveSummaryToChat(scoreData);
        
        if (onBenchmarkComplete) {
          onBenchmarkComplete();
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Benchmark processing encountered an error.');
        setStatus('failed');
        clearInterval(interval);
      }
    };

    startBenchmark();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [documentId, storagePath]);

  // Formats and saves a summary of the benchmark in the chat history
  const saveSummaryToChat = async (benchmarkData: any) => {
    if (!chatId || !benchmarkData) return;
    
    const results = benchmarkData.results || [];
    const rec = benchmarkData.recommendation || {};
    
    // Format message
    const sorted = [...results].sort((a, b) => b.scores.overall_score - a.scores.overall_score);
    const scoreLines = sorted
      .map(r => `*   **${r.engine_name}**: ${r.scores.overall_score.toFixed(1)} / 100`)
      .join('\n');
      
    const content = `🔬 **OCR Benchmark Complete** for *${documentName}*\n\n` +
      `**Winner**: \`${rec.best_overall}\`\n\n` +
      `**Scores:**\n${scoreLines}\n\n` +
      `**Recommendation**:\n${rec.recommendation_text}`;
      
    try {
      await createMessage(chatId, 'assistant', content);
    } catch (err) {
      console.error('Failed to auto-insert benchmark message in chat history:', err);
    }

  };

  const handleCopyReport = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.report_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity duration-300">
      
      {/* Modal Dialog Content container */}
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-3xl border border-neutral-800 bg-neutral-950 p-6 text-neutral-200 shadow-2xl overflow-hidden">
        
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-inner">
              <Gauge className="h-4.5 w-4.5 text-white" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">OCR & Extraction Benchmark</h3>
              <p className="text-[10px] text-neutral-500 font-medium max-w-[400px] truncate leading-none mt-1">
                Analyzing: {documentName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
            title="Close Benchmark Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner Content states */}
        <div className="flex-1 overflow-y-auto py-5 select-none scrollbar-thin">
          
          {/* STATE 1: RUNNING / LOADING PROGRESS */}
          {status === 'running' && (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
              <div className="relative flex items-center justify-center mb-8 h-20 w-20">
                <span className="absolute inset-0 rounded-full border-4 border-indigo-900/40 animate-ping opacity-75" />
                <span className="absolute inset-0 rounded-full border-t-4 border-indigo-500 animate-spin" />
                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin absolute" />
              </div>
              
              <h4 className="text-sm font-bold text-neutral-200 mb-2">Analyzing Extraction Quality</h4>
              <p className="text-xs text-neutral-400 leading-relaxed min-h-[36px] italic">
                {steps[progressStep]}
              </p>
              
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mt-6 w-full">
                {steps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === progressStep 
                        ? 'w-6 bg-indigo-500' 
                        : idx < progressStep 
                          ? 'w-2 bg-emerald-500' 
                          : 'w-2 bg-neutral-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STATE 2: FAILED ERROR SCREEN */}
          {status === 'failed' && (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950/20 border border-red-900/30 text-red-400 mb-5">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h4 className="text-sm font-bold text-neutral-200 mb-2">Benchmark Execution Failed</h4>
              <p className="text-xs text-red-400/90 leading-relaxed font-medium mb-6">
                {error || 'An unexpected server issue occurred.'}
              </p>
              <button 
                onClick={onClose}
                className="rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 px-5 py-2.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          )}

          {/* STATE 3: COMPLETED RESULTS VIEW */}
          {status === 'completed' && data && (
            <div className="space-y-6">
              
              {/* Winner Announcement Card */}
              <div className="rounded-2xl border border-indigo-950 bg-indigo-950/25 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-500 text-white shadow-md">
                    <Award className="h-6 w-6 text-neutral-950 font-bold" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider leading-none">Overall Winner</h4>
                    <h3 className="text-lg font-bold text-neutral-100 mt-1.5 flex items-center gap-2">
                      {data.recommendation.best_overall}
                      <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full font-medium">
                        Score: {data.results.find((r: any) => r.engine_name === data.recommendation.best_overall)?.scores.overall_score.toFixed(1)}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-300 mt-2.5 leading-relaxed font-medium">
                      {data.recommendation.recommendation_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 border-b border-neutral-900 pb-1.5">
                {[
                  { id: 'summary', label: 'Executive Report', icon: FileText },
                  { id: 'charts', label: 'Visual Comparison', icon: BarChart3 },
                  { id: 'raw', label: 'Raw Performance', icon: Activity }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === tab.id 
                          ? 'bg-neutral-900 text-white border border-neutral-800' 
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: EXECUTIVE SUMMARY REPORT */}
              {activeTab === 'summary' && (
                <div className="space-y-5">
                  {/* Summary Scores Table */}
                  <div className="overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/40">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-900 bg-neutral-950 text-neutral-400 font-semibold">
                          <th className="p-3.5">Engine</th>
                          <th className="p-3.5 text-center">Overall Score</th>
                          <th className="p-3.5 text-center">Retrieval (40%)</th>
                          <th className="p-3.5 text-center">Chunking (20%)</th>
                          <th className="p-3.5 text-center">Extraction (15%)</th>
                          <th className="p-3.5 text-center">Speed (15%)</th>
                          <th className="p-3.5 text-center">Resources (10%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/60 font-medium">
                        {data.results.map((r: any) => {
                          const isWinner = r.engine_name === data.recommendation.best_overall;
                          return (
                            <tr 
                              key={r.engine_name} 
                              className={`transition-colors ${
                                isWinner 
                                  ? 'bg-indigo-950/10 hover:bg-indigo-950/20 text-neutral-100 font-semibold' 
                                  : 'hover:bg-neutral-900/35 text-neutral-400'
                              }`}
                            >
                              <td className="p-3.5 flex items-center gap-1.5">
                                {isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                                {r.engine_name}
                              </td>
                              <td className="p-3.5 text-center text-neutral-200 font-bold">{r.scores.overall_score.toFixed(1)}</td>
                              <td className="p-3.5 text-center">{r.scores.retrieval_score.toFixed(1)}</td>
                              <td className="p-3.5 text-center">{r.scores.chunk_quality_score.toFixed(1)}</td>
                              <td className="p-3.5 text-center">{r.scores.extraction_score.toFixed(1)}</td>
                              <td className="p-3.5 text-center">{r.scores.speed_score.toFixed(1)}</td>
                              <td className="p-3.5 text-center">{r.scores.resource_score.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Generated Report Display */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 p-5 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[35vh] scrollbar-thin">
                    <pre className="whitespace-pre-wrap font-sans text-neutral-300">{data.report_markdown}</pre>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy Markdown Report'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: VISUAL CHARTS (RECHARTS) */}
              {activeTab === 'charts' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                  
                  {/* Chart A: Overall Ranking */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-950/40 p-4 flex flex-col h-[280px]">
                    <h5 className="text-xs font-bold text-neutral-400 mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                      Overall Performance Ranking
                    </h5>
                    <div className="flex-1 w-full text-neutral-200">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.charts.overall_ranking} margin={{ bottom: 20 }}>
                          <XAxis 
                            dataKey="name" 
                            stroke="#525252" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#525252" 
                            fontSize={10} 
                            domain={[0, 100]} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', fontSize: '11px', color: '#e5e5e5' }}
                          />
                          <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                            {data.charts.overall_ranking.map((entry: any, index: number) => {
                              const isWinner = entry.name === data.recommendation.best_overall;
                              return <Cell key={`cell-${index}`} fill={isWinner ? '#6366f1' : '#404040'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart B: Radar Performance Comparison */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-950/40 p-4 flex flex-col h-[280px]">
                    <h5 className="text-xs font-bold text-neutral-400 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Multivariate Radar Comparison
                    </h5>
                    <div className="flex-1 w-full text-neutral-200 flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.charts.radar_data}>
                          <PolarGrid stroke="#262626" />
                          <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={9} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#404040" fontSize={8} />
                          {data.results.map((r: any, idx: number) => {
                            const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                            return (
                              <Radar 
                                key={r.engine_name} 
                                name={r.engine_name} 
                                dataKey={r.engine_name} 
                                stroke={colors[idx % colors.length]} 
                                fill={colors[idx % colors.length]} 
                                fillOpacity={0.15} 
                              />
                            );
                          })}
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', fontSize: '11px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart C: Speed Comparison (Lower processing time is better) */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-950/40 p-4 flex flex-col h-[280px]">
                    <h5 className="text-xs font-bold text-neutral-400 mb-4 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      Total Processing Time (Lower is Better)
                    </h5>
                    <div className="flex-1 w-full text-neutral-200">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.charts.speed_comparison} margin={{ bottom: 20 }}>
                          <XAxis 
                            dataKey="name" 
                            stroke="#525252" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#525252" 
                            fontSize={10} 
                            unit="s"
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', fontSize: '11px' }}
                          />
                          <Bar dataKey="time" radius={[8, 8, 0, 0]}>
                            {data.charts.speed_comparison.map((entry: any, index: number) => {
                              const isFastest = entry.name === data.recommendation.fastest;
                              return <Cell key={`cell-${index}`} fill={isFastest ? '#10b981' : '#404040'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart D: RAM Usage Comparison */}
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-950/40 p-4 flex flex-col h-[280px]">
                    <h5 className="text-xs font-bold text-neutral-400 mb-4 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      Memory Peak Usage (Lower is Better)
                    </h5>
                    <div className="flex-1 w-full text-neutral-200">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.charts.resource_comparison} margin={{ bottom: 20 }}>
                          <XAxis 
                            dataKey="name" 
                            stroke="#525252" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#525252" 
                            fontSize={10} 
                            unit=" MB"
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', fontSize: '11px' }}
                          />
                          <Bar dataKey="ram" radius={[8, 8, 0, 0]}>
                            {data.charts.resource_comparison.map((entry: any, index: number) => {
                              const isEfficient = entry.name === data.recommendation.most_efficient;
                              return <Cell key={`cell-${index}`} fill={isEfficient ? '#f59e0b' : '#404040'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: RAW PERFORMANCE METRICS */}
              {activeTab === 'raw' && (
                <div className="overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/40">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-900 bg-neutral-950 text-neutral-400 font-semibold">
                        <th className="p-3.5">Engine</th>
                        <th className="p-3.5">Processing Time</th>
                        <th className="p-3.5 text-right">Extracted Chars</th>
                        <th className="p-3.5 text-right">Extracted Words</th>
                        <th className="p-3.5 text-right">Chunks Created</th>
                        <th className="p-3.5 text-right">Avg CPU Usage</th>
                        <th className="p-3.5 text-right">Peak RAM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/60 font-medium text-neutral-300">
                      {data.results.map((r: any) => (
                        <tr key={r.engine_name} className="hover:bg-neutral-900/35 transition-colors">
                          <td className="p-3.5 font-bold text-neutral-200">{r.engine_name}</td>
                          <td className="p-3.5">{r.metrics.processing_time.toFixed(2)}s</td>
                          <td className="p-3.5 text-right">{r.metrics.character_count.toLocaleString()}</td>
                          <td className="p-3.5 text-right">{r.metrics.word_count.toLocaleString()}</td>
                          <td className="p-3.5 text-right">{r.metrics.chunk_count}</td>
                          <td className="p-3.5 text-right text-amber-500/90">{r.metrics.cpu_usage.toFixed(1)}%</td>
                          <td className="p-3.5 text-right text-yellow-500/90">{r.metrics.memory_usage.toFixed(1)} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

        </div>
        
        {/* Footer controls */}
        {status === 'completed' && (
          <div className="flex justify-end border-t border-neutral-900 pt-4">
            <button
              onClick={onClose}
              className="rounded-xl bg-white hover:bg-neutral-200 text-black px-5 py-2.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              Back to Chat
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
