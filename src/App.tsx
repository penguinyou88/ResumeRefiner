import React, { useState, useRef } from 'react';
import { Upload, FileText, Wand2, Download, Eye, Edit3, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { analyzeResume, generateStyledResume, rewriteContent, type ResumeData } from '@/src/services/gemini';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function App() {
  const [step, setStep] = useState<'upload' | 'refine' | 'preview'>('upload');
  const [userData, setUserData] = useState<ResumeData | null>(null);
  const [styleRef, setStyleRef] = useState<{ data: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const resumeRef = useRef<HTMLDivElement>(null);
  const userResumeInputRef = useRef<HTMLInputElement>(null);
  const styleRefInputRef = useRef<HTMLInputElement>(null);

  const handleUserResumeUpload = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const data = await analyzeResume(base64, file.type);
        setUserData(data);
      } catch (err) {
        console.error("Analysis failed", err);
        alert("Failed to analyze resume. Please try again or paste text.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStyleRefUpload = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setStyleRef({ data: reader.result as string, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent, type: 'user' | 'style') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (type === 'user') handleUserResumeUpload(file);
      else handleStyleRefUpload(file);
    }
  };

  const handleRewrite = async (type: 'summary' | 'experience', index?: number, bulletIndex?: number) => {
    if (!userData) return;
    let content = '';
    let context = '';

    if (type === 'summary') {
      content = userData.summary;
      context = 'Professional summary';
    } else if (type === 'experience' && index !== undefined && bulletIndex !== undefined) {
      content = userData.experience[index].description[bulletIndex];
      context = `Job description for ${userData.experience[index].position} at ${userData.experience[index].company}`;
    }

    try {
      const rewritten = await rewriteContent(content, context);
      if (type === 'summary') {
        setUserData({ ...userData, summary: rewritten });
      } else if (type === 'experience' && index !== undefined && bulletIndex !== undefined) {
        const newExp = [...userData.experience];
        newExp[index].description[bulletIndex] = rewritten;
        setUserData({ ...userData, experience: newExp });
      }
    } catch (err) {
      console.error("Rewrite failed", err);
    }
  };

  const handleGenerate = async () => {
    if (!userData) return;
    setIsGenerating(true);
    try {
      const html = await generateStyledResume(userData, styleRef || undefined);
      setGeneratedHtml(html);
      setStep('preview');
    } catch (err) {
      console.error("Generation failed", err);
      alert("Failed to generate styled resume.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!resumeRef.current) return;
    const element = resumeRef.current;
    const opt = {
      margin: 0,
      filename: `${userData?.personalInfo.name || 'Resume'}_Refined.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
            <h1 className="text-xl font-semibold tracking-tight">ResumeRefiner</h1>
          </div>
          
          <nav className="flex items-center gap-1 bg-black/5 p-1 rounded-full">
            <button 
              onClick={() => setStep('upload')}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                step === 'upload' ? "bg-white shadow-sm text-black" : "text-black/50 hover:text-black"
              )}
            >
              1. Upload
            </button>
            <button 
              disabled={!userData}
              onClick={() => setStep('refine')}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-30",
                step === 'refine' ? "bg-white shadow-sm text-black" : "text-black/50 hover:text-black"
              )}
            >
              2. Refine
            </button>
            <button 
              disabled={!generatedHtml}
              onClick={() => setStep('preview')}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-30",
                step === 'preview' ? "bg-white shadow-sm text-black" : "text-black/50 hover:text-black"
              )}
            >
              3. Preview
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {step === 'preview' && (
              <button 
                onClick={downloadPdf}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/90 transition-all"
              >
                <Download size={16} />
                Export PDF
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {/* User Resume Upload */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Your Current Resume</h2>
                    <p className="text-sm text-black/50">Upload your existing resume to extract content</p>
                  </div>
                </div>

                <div 
                  onClick={() => userResumeInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, 'user')}
                  className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-black/10 rounded-2xl cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all overflow-hidden"
                >
                  {userData ? (
                    <div className="flex flex-col items-center gap-2 text-emerald-600">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Wand2 size={24} />
                      </div>
                      <p className="font-medium">Resume Analyzed!</p>
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setUserData(null); 
                        }}
                        className="text-xs text-black/40 hover:text-red-500 underline relative z-10"
                      >
                        Change File
                      </button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium text-black/60">Analyzing your resume...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-4 text-black/20 group-hover:text-emerald-500 transition-colors" size={40} />
                      <p className="text-sm font-medium text-black/60">Click to upload or drag and drop</p>
                      <p className="text-xs text-black/40 mt-1">PDF, Image, or Word</p>
                    </>
                  )}
                </div>
                <input 
                  ref={userResumeInputRef}
                  type="file" 
                  className="hidden" 
                  onChange={handleUserResumeUpload} 
                  accept=".pdf,image/*" 
                />

                {userData && (
                  <div className="mt-6 p-4 bg-black/5 rounded-xl">
                    <p className="text-xs font-bold text-black/40 uppercase tracking-wider mb-2">Extracted Info</p>
                    <div className="space-y-1">
                      <p className="font-medium">{userData.personalInfo.name}</p>
                      <p className="text-sm text-black/60">{userData.personalInfo.email}</p>
                      <p className="text-sm text-black/60">{userData.experience.length} Experience items found</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Style Reference Upload */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Style Reference (Optional)</h2>
                    <p className="text-sm text-black/50">Upload a resume you like to mimic its style</p>
                  </div>
                </div>

                <div 
                  onClick={() => styleRefInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, 'style')}
                  className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-black/10 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-50/30 transition-all overflow-hidden"
                >
                  {styleRef ? (
                    <div className="flex flex-col items-center gap-2 text-indigo-600">
                      <img src={styleRef.data} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="Style reference" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                          <Plus size={24} />
                        </div>
                        <p className="font-medium">Style Reference Set</p>
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setStyleRef(null); 
                          }}
                          className="text-xs text-black/40 hover:text-red-500 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-4 text-black/20 group-hover:text-indigo-500 transition-colors" size={40} />
                      <p className="text-sm font-medium text-black/60">Upload an image or PDF of a resume</p>
                      <p className="text-xs text-black/40 mt-1">We'll match the layout and fonts</p>
                    </>
                  )}
                </div>
                <input 
                  ref={styleRefInputRef}
                  type="file" 
                  className="hidden" 
                  onChange={handleStyleRefUpload} 
                  accept="image/*,.pdf" 
                />

                <div className="mt-8 flex justify-end">
                  <button 
                    disabled={!userData || isGenerating}
                    onClick={handleGenerate}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 size={20} />
                        Refine My Resume
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'refine' && userData && (
            <motion.div 
              key="refine"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-black/5"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Refine Content</h2>
                  <p className="text-black/50">Edit the extracted content before generating the final design</p>
                </div>
                <button 
                  onClick={handleGenerate}
                  className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-black/90 transition-all"
                >
                  <Wand2 size={18} />
                  Regenerate
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  {/* Personal Info */}
                  <section>
                    <h3 className="text-sm font-bold text-black/40 uppercase tracking-widest mb-4">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/40">Full Name</label>
                        <input 
                          value={userData.personalInfo.name} 
                          onChange={(e) => setUserData({...userData, personalInfo: {...userData.personalInfo, name: e.target.value}})}
                          className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-black/40">Email</label>
                        <input 
                          value={userData.personalInfo.email} 
                          onChange={(e) => setUserData({...userData, personalInfo: {...userData.personalInfo, email: e.target.value}})}
                          className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Summary */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-black/40 uppercase tracking-widest">Professional Summary</h3>
                      <button 
                        onClick={() => handleRewrite('summary')}
                        className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        <Wand2 size={12} /> Rewrite with AI
                      </button>
                    </div>
                    <textarea 
                      rows={4}
                      value={userData.summary} 
                      onChange={(e) => setUserData({...userData, summary: e.target.value})}
                      className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                    />
                  </section>

                  {/* Skills */}
                  <section>
                    <h3 className="text-sm font-bold text-black/40 uppercase tracking-widest mb-4">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {userData.skills.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                          {skill}
                          <button 
                            onClick={() => setUserData({...userData, skills: userData.skills.filter((_, i) => i !== idx)})}
                            className="hover:text-emerald-900"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const s = prompt("Add skill");
                          if (s) setUserData({...userData, skills: [...userData.skills, s]});
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-black/20 text-black/40 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                      >
                        <Plus size={14} /> Add Skill
                      </button>
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  {/* Experience */}
                  <section>
                    <h3 className="text-sm font-bold text-black/40 uppercase tracking-widest mb-4">Experience</h3>
                    <div className="space-y-4">
                      {userData.experience.map((exp, idx) => (
                        <div key={idx} className="p-4 border border-black/5 rounded-2xl hover:border-emerald-500/30 transition-all group">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <input 
                                className="font-bold text-lg bg-transparent border-none p-0 focus:ring-0 w-full"
                                value={exp.position}
                                onChange={(e) => {
                                  const newExp = [...userData.experience];
                                  newExp[idx].position = e.target.value;
                                  setUserData({...userData, experience: newExp});
                                }}
                              />
                              <input 
                                className="text-sm text-black/50 bg-transparent border-none p-0 focus:ring-0 w-full"
                                value={exp.company}
                                onChange={(e) => {
                                  const newExp = [...userData.experience];
                                  newExp[idx].company = e.target.value;
                                  setUserData({...userData, experience: newExp});
                                }}
                              />
                            </div>
                            <button 
                              onClick={() => setUserData({...userData, experience: userData.experience.filter((_, i) => i !== idx)})}
                              className="opacity-0 group-hover:opacity-100 text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="space-y-2 mt-4">
                            {exp.description.map((bullet, bIdx) => (
                              <div key={bIdx} className="flex gap-2 group/bullet">
                                <span className="text-emerald-500 mt-1">•</span>
                                <div className="flex-1 relative">
                                  <textarea 
                                    className="text-sm text-black/70 bg-transparent border-none p-0 focus:ring-0 w-full resize-none"
                                    value={bullet}
                                    onChange={(e) => {
                                      const newExp = [...userData.experience];
                                      newExp[idx].description[bIdx] = e.target.value;
                                      setUserData({...userData, experience: newExp});
                                    }}
                                  />
                                  <button 
                                    onClick={() => handleRewrite('experience', idx, bIdx)}
                                    className="absolute right-0 top-0 opacity-0 group-hover/bullet:opacity-100 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded transition-all"
                                  >
                                    Rewrite
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center"
            >
              <div className="w-full max-w-[8.5in] bg-white shadow-2xl rounded-sm overflow-hidden mb-12">
                <div 
                  ref={resumeRef}
                  className="resume-container"
                  dangerouslySetInnerHTML={{ __html: generatedHtml }}
                />
              </div>

              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur-xl border border-black/5 p-2 rounded-2xl shadow-2xl z-50">
                <button 
                  onClick={() => setStep('refine')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-all"
                >
                  <Edit3 size={16} />
                  Edit Content
                </button>
                <div className="w-px h-4 bg-black/10" />
                <button 
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-all"
                >
                  <Wand2 size={16} />
                  Regenerate Design
                </button>
                <div className="w-px h-4 bg-black/10" />
                <button 
                  onClick={downloadPdf}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background Accents */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/30 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
