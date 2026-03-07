import React, { useState, useEffect, useRef } from "react";

function App() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [profileData, setProfileData] = useState<any>(null);
  
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState("guest");
  const [errorMsg, setErrorMsg] = useState("");

  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [newPersona, setNewPersona] = useState("");

  // Reflection Engine State
  const [mood, setMood] = useState<string | null>(null);
  const [reflectionInput, setReflectionInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reflectionsHistory, setReflectionsHistory] = useState<any[]>([]);
  
  // Deep Analysis State
  const [analysisData, setAnalysisData] = useState<{
    swot: {strengths: string, weaknesses: string, opportunities: string, threats: string},
    www_ebi: {what_went_well: string, even_better_if: string},
    five_whys: string[],
    quote: string
  } | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // UI States
  const [visibleCount, setVisibleCount] = useState(2);
  const [editingRefId, setEditingRefId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isNexusTyping, setIsNexusTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'nexus', text: string}[]>([
    { role: 'nexus', text: 'I am here. What is on your mind today?' }
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (token) {
      fetch("http://127.0.0.1:8000/api/profile/", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error("Token expired");
        return res.json();
      })
      .then(data => setProfileData(data))
      .catch(() => handleLogout()); 

      fetchReflections();
    }
  }, [token]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isNexusTyping]);

  const fetchReflections = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/reflections/", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReflectionsHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    const url = isLoginView ? "http://127.0.0.1:8000/api/login/" : "http://127.0.0.1:8000/api/signup/";
    const payload = isLoginView ? { username: email, password } : { first_name: firstName, last_name: lastName, email, password, persona };

    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Authentication failed");

      localStorage.setItem("access_token", data.access);
      setToken(data.access);
      if (!isLoginView && data.user) {
        setProfileData({ ...profileData, first_name: firstName, name: data.user.name, persona: data.user.persona, username: data.user.email });
      }
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleUpdatePersona = async () => {
    try {
      await fetch("http://127.0.0.1:8000/api/profile/", {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ persona: newPersona }),
      });
      setProfileData({ ...profileData, persona: newPersona });
      setIsEditingPersona(false);
    } catch (err) {
      setProfileData({ ...profileData, persona: newPersona });
      setIsEditingPersona(false);
    }
  };

  const submitReflection = async (customContent?: string, customMood?: string | null) => {
    const finalContent = customContent || reflectionInput;
    const finalMood = customMood !== undefined ? customMood : mood;

    if (!finalContent.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/reflections/", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ content: finalContent, mood: finalMood }),
      });
      if (res.ok) {
        const newReflection = await res.json();
        setReflectionsHistory([newReflection, ...reflectionsHistory]);
        setSelectedDateFilter(null); // Clear filter to show the new entry immediately
        if (!customContent) {
          setReflectionInput("");
          setMood(null);
        }
      }
    } catch (err) { console.error(err); } 
    finally { setIsAnalyzing(false); }
  };

  const handleDeleteReflection = async (id: number) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/reflections/${id}/`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      setReflectionsHistory(reflectionsHistory.filter(ref => ref.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/reflections/${id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        const updatedRef = await res.json();
        setReflectionsHistory(reflectionsHistory.map(ref => ref.id === id ? updatedRef : ref));
        setEditingRefId(null);
      }
    } catch (err) { console.error(err); }
  };

  // Generate Advanced Deep Analysis
  const handleGenerateAnalysis = async () => {
    setIsAnalysisLoading(true);
    setAnalysisError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/analysis/", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate analysis.");
      setAnalysisData(data);
    } catch (err: any) {
      setAnalysisError(err.message);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setToken(null); setProfileData(null); setReflectionsHistory([]); setAnalysisData(null);
    setSelectedDateFilter(null);
    setEmail(""); setPassword("");
  };

  const getDisplayName = () => {
    if (!profileData) return "";
    return profileData.first_name || profileData.name || profileData.username?.split('@')[0] || "Traveler";
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userText = chatInput;
    const newMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsNexusTyping(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat/", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages([...newMessages, { role: 'nexus', text: data.reply }]);
      } else {
        setChatMessages([...newMessages, { role: 'nexus', text: "I'm having a little trouble connecting right now." }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: 'nexus', text: "I feel disconnected. Make sure Ollama is running!" }]);
    } finally {
      setIsNexusTyping(false);
    }
  };

  const handleSaveChatToMemory = async () => {
    if (chatMessages.length <= 1) { setIsChatOpen(false); return; }
    const transcript = chatMessages.map(m => `${m.role === 'user' ? 'Me' : 'Nexus'}: ${m.text}`).join('\n\n');
    setIsChatOpen(false);
    setChatMessages([{ role: 'nexus', text: 'I am here. What is on your mind today?' }]);
    await submitReflection(`[Friendship Chat Transcript]\n\n${transcript}`, 'thinking');
  };

  const moodOptions = [
    { id: 'calm', icon: '😌', label: 'Calm', themeDark: 'hover:bg-emerald-500/20 text-emerald-400', themeLight: 'hover:bg-emerald-500/10 text-emerald-600' },
    { id: 'joyful', icon: '✨', label: 'Joyful', themeDark: 'hover:bg-yellow-500/20 text-yellow-400', themeLight: 'hover:bg-yellow-500/10 text-yellow-600' },
    { id: 'thinking', icon: '🤔', label: 'Thinking', themeDark: 'hover:bg-purple-500/20 text-purple-400', themeLight: 'hover:bg-purple-500/10 text-purple-600' },
    { id: 'motivated', icon: '🔥', label: 'Motivated', themeDark: 'hover:bg-cyan-500/20 text-cyan-400', themeLight: 'hover:bg-cyan-500/10 text-cyan-600' },
    { id: 'anxious', icon: '😰', label: 'Anxious', themeDark: 'hover:bg-orange-500/20 text-orange-400', themeLight: 'hover:bg-orange-500/10 text-orange-600' },
    { id: 'low', icon: '😞', label: 'Low', themeDark: 'hover:bg-blue-500/20 text-blue-400', themeLight: 'hover:bg-blue-500/10 text-blue-600' },
    { id: 'grateful', icon: '🙏', label: 'Grateful', themeDark: 'hover:bg-pink-500/20 text-pink-400', themeLight: 'hover:bg-pink-500/10 text-pink-600' },
    { id: 'exhausted', icon: '😴', label: 'Exhausted', themeDark: 'hover:bg-slate-500/20 text-slate-400', themeLight: 'hover:bg-slate-500/10 text-slate-600' },
  ];
  const getMoodIcon = (moodId: string) => moodOptions.find(m => m.id === moodId)?.icon || '✨';

  // Format Markdown
  const formatMarkdownText = (text: string) => {
    if (!text) return { __html: "" };
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/\n/g, '<br/>');
    return { __html: formatted };
  };

  const parseInsight = (text: string) => {
    if (!text) return { content: "", tags: [] };
    const tagRegex = /(#[a-zA-Z0-9_-]+)/g;
    const tags = text.match(tagRegex) || [];
    const content = text.replace(tagRegex, '').trim();
    return { content, tags };
  };

  const calculateStreak = () => {
    if (reflectionsHistory.length === 0) return 0;
    const activityMap = new Set(reflectionsHistory.map(ref => new Date(ref.created_at).setHours(0,0,0,0)));
    const today = new Date().setHours(0,0,0,0);
    let streak = 0;
    let checkDate = new Date(today);

    if (!activityMap.has(checkDate.getTime())) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (!activityMap.has(checkDate.getTime())) return 0;
    }
    while(activityMap.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  };

  const getLifeGrid = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const activityMap = new Map();
    reflectionsHistory.forEach(ref => {
      const refDate = new Date(ref.created_at);
      const dayKey = new Date(refDate).setHours(0,0,0,0);
      if (!activityMap.has(dayKey)) activityMap.set(dayKey, { count: 0, times: [] });
      const dayData = activityMap.get(dayKey);
      dayData.count += 1;
      dayData.times.push(refDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });

    return Array.from({ length: daysInMonth }).map((_, i) => {
      const day = i + 1;
      const targetDate = new Date(year, month, day);
      const targetTime = targetDate.getTime();
      const isFuture = targetTime > today.getTime();
      
      const dayData = activityMap.get(targetTime);
      const count = dayData ? dayData.count : 0;
      
      let tooltip = `${targetDate.toLocaleDateString()}: No Entry`;
      if (dayData) tooltip = `${targetDate.toLocaleDateString()}: ${count} Reflection${count > 1 ? 's' : ''}\nTime: ${dayData.times.join(', ')}`;
      else if (isFuture) tooltip = `${targetDate.toLocaleDateString()}: Future`;

      let activeColorClass = 'w-[14px] h-[14px] sm:w-[18px] sm:h-[18px] rounded-[4px] transition-all duration-300 ';

      if (count > 0) {
        activeColorClass += 'cursor-pointer hover:scale-125 ';
        if (theme === 'dark') {
          activeColorClass += count === 1 ? 'bg-[#5EEAD4]/70 shadow-[0_0_10px_rgba(94,234,212,0.4)]' : 'bg-[#5EEAD4] shadow-[0_0_15px_rgba(94,234,212,0.8)] scale-110';
        } else {
          activeColorClass += count === 1 ? 'bg-[#6366F1]/70 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-[#6366F1] shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110';
        }
      } else if (isFuture) {
        activeColorClass += 'cursor-default ';
        activeColorClass += theme === 'dark' ? 'bg-[#161A23] border border-[#2A3040]' : 'bg-[#F7F8FB] border border-[#E3E6EF]';
      } else {
        activeColorClass += 'cursor-default ';
        activeColorClass += theme === 'dark' ? 'bg-[#2A3040] opacity-40 hover:opacity-60' : 'bg-[#E3E6EF] hover:bg-[#D1D5DB]';
      }
      
      return (
        <div 
          key={i} 
          title={tooltip} 
          onClick={() => {
            if (count > 0) {
              setSelectedDateFilter(targetDate.toDateString());
              document.getElementById('memory-log-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={activeColorClass} 
        />
      );
    });
  };

  const displayedReflections = selectedDateFilter 
    ? reflectionsHistory.filter(ref => new Date(ref.created_at).toDateString() === selectedDateFilter)
    : reflectionsHistory.slice(0, visibleCount);

  return (
    <div className={`relative flex flex-col min-h-screen transition-colors duration-700 font-['Inter',sans-serif] selection:bg-[#5EEAD4] selection:text-[#0F1117] ${
      theme === 'dark' ? 'bg-[#0F1117] text-[#E6EAF2]' : 'bg-[#F7F8FB] text-[#1F2937] selection:bg-[#6366F1] selection:text-white'
    }`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=Source+Serif+4:ital,wght@0,300;0,400;1,300;1,400&display=swap');`}</style>
      
      {/* Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] opacity-20 pointer-events-none blur-[100px] sm:blur-[120px] transition-all duration-1000 z-0 fixed"
           style={{ background: theme === 'dark' ? 'radial-gradient(circle, #5EEAD4 0%, transparent 70%)' : 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }} />

      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`fixed top-4 right-4 sm:top-8 sm:right-8 p-3 rounded-full backdrop-blur-md transition-all duration-500 hover:scale-110 active:scale-95 z-50 ${theme === 'dark' ? 'bg-[#1D2230]/80 text-[#5EEAD4] hover:bg-[#2A3040] shadow-[0_0_15px_rgba(94,234,212,0.1)]' : 'bg-white/80 text-[#6366F1] hover:bg-[#F1F3F9] shadow-[0_4px_15px_rgba(0,0,0,0.05)]'}`}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* --- FLOATING CHATBOT UI --- */}
      {token && profileData && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
          {isChatOpen && (
            <div className={`mb-4 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[80vh] sm:h-[500px] flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 animate-fade-in-up border ${theme === 'dark' ? 'bg-[#161A23] border-[#2A3040]' : 'bg-white border-[#E3E6EF]'}`}>
              <div className={`p-4 flex justify-between items-center border-b ${theme === 'dark' ? 'bg-[#1D2230] border-[#2A3040]' : 'bg-[#F7F8FB] border-[#E3E6EF]'}`}>
                <div className="flex items-center gap-2"><span className="text-xl">🌌</span><span className={`font-medium tracking-wide ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`}>Nexus Companion</span></div>
                <button onClick={() => setIsChatOpen(false)} className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
              <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? (theme === 'dark' ? 'bg-[#5EEAD4]/20 text-[#E6EAF2] rounded-tr-sm' : 'bg-[#6366F1]/10 text-[#1F2937] rounded-tr-sm') : (theme === 'dark' ? 'bg-[#2A3040] text-[#A4A9B6] rounded-tl-sm' : 'bg-[#F1F3F9] text-[#4B5563] rounded-tl-sm')}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={formatMarkdownText(msg.text)}></p>
                    </div>
                  </div>
                ))}
                {isNexusTyping && (
                  <div className="flex justify-start">
                    <div className={`max-w-[80%] p-4 rounded-2xl rounded-tl-sm flex gap-1 ${theme === 'dark' ? 'bg-[#2A3040]' : 'bg-[#F1F3F9]'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
              </div>
              <div className={`p-3 border-t flex flex-col gap-2 ${theme === 'dark' ? 'bg-[#1D2230] border-[#2A3040]' : 'bg-[#F7F8FB] border-[#E3E6EF]'}`}>
                <div className="flex gap-2">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()} placeholder="Type your thoughts..." className={`flex-1 p-2.5 rounded-xl text-sm border-none focus:ring-1 focus:outline-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-white placeholder-[#6B7280]' : 'bg-white focus:ring-[#6366F1]/50 text-[#1F2937] placeholder-[#9CA3AF]'}`} />
                  <button onClick={handleSendChatMessage} disabled={!chatInput.trim()} className={`p-2.5 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-[#5EEAD4] text-[#0F1117] hover:bg-[#A78BFA]' : 'bg-[#6366F1] text-white hover:bg-[#22D3EE]'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  </button>
                </div>
                <button onClick={handleSaveChatToMemory} disabled={chatMessages.length <= 1 || isAnalyzing} className={`w-full py-2.5 rounded-xl text-xs uppercase tracking-wider font-medium transition-all duration-300 border ${theme === 'dark' ? 'border-[#2A3040] text-[#A4A9B6] hover:bg-[#5EEAD4]/10 hover:text-[#5EEAD4] hover:border-[#5EEAD4]/30 disabled:opacity-30' : 'border-[#E3E6EF] text-[#6B7280] hover:bg-[#6366F1]/10 hover:text-[#6366F1] hover:border-[#6366F1]/30 disabled:opacity-30'}`}>
                  {isAnalyzing ? "Processing Transcript..." : "End & Save to Memory Log"}
                </button>
              </div>
            </div>
          )}
          <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-500 hover:scale-110 active:scale-95 ${theme === 'dark' ? 'bg-gradient-to-tr from-[#5EEAD4] to-[#A78BFA] text-[#0F1117]' : 'bg-gradient-to-tr from-[#6366F1] to-[#22D3EE] text-white'}`}>
            {isChatOpen ? <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> : <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center w-full p-4 sm:p-6 lg:p-8">
        {token ? (
          <div className="w-full max-w-3xl animate-fade-in-up pb-12 mt-12 sm:mt-0">
            <header className="mb-8 text-center">
              <h1 className="text-3xl sm:text-4xl font-light tracking-widest mb-2">VISCORA <span className={`font-normal ${theme === 'dark' ? 'text-[#5EEAD4]' : 'text-[#6366F1]'}`}>NEXUS</span></h1>
            </header>
            
            {profileData ? (
              <>
                <div className={`p-5 sm:p-10 rounded-3xl transition-all duration-500 mb-10 relative z-20 ${theme === 'dark' ? 'bg-[#161A23] border border-[#2A3040] shadow-[0_8px_30px_rgba(0,0,0,0.45)]' : 'bg-white border border-[#E3E6EF] shadow-[0_8px_30px_rgba(0,0,0,0.04)]'}`}>
                  
                  {/* Greeting & Inline Persona Setting */}
                  <div className="flex justify-between items-start mb-8 sm:mb-10">
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-light mb-1">Welcome back, <span className="font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-[#5EEAD4] dark:to-[#A78BFA]">{getDisplayName()}</span>.</h2>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>Persona:</span>
                        {!isEditingPersona ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs sm:text-sm font-medium capitalize ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`}>{profileData.persona}</span>
                            <button onClick={() => { setIsEditingPersona(true); setNewPersona(profileData.persona); }} className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-[#2A3040] text-[#A4A9B6]' : 'hover:bg-[#E3E6EF] text-[#6B7280]'}`} title="Edit Persona">
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select value={newPersona} onChange={(e) => setNewPersona(e.target.value)} className={`p-1 text-[10px] sm:text-xs rounded-md border focus:outline-none transition-all duration-300 ${theme === 'dark' ? 'bg-[#161A23] border-[#2A3040] text-white focus:border-[#5EEAD4]' : 'bg-white border-[#E3E6EF] text-[#1F2937] focus:border-[#6366F1]'}`}>
                              <option value="guest">Guest</option><option value="student">Student</option><option value="homemaker">Homemaker</option><option value="professional">Professional</option>
                            </select>
                            <button onClick={handleUpdatePersona} className="text-emerald-500 hover:text-emerald-400 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></button>
                            <button onClick={() => setIsEditingPersona(false)} className="text-rose-500 hover:text-rose-400 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={handleLogout} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-[#6B7280] hover:bg-[#1D2230] hover:text-white' : 'text-[#9CA3AF] hover:bg-[#F1F3F9] hover:text-[#1F2937]'}`} title="Disconnect"><svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg></button>
                  </div>

                  {/* Hero Consistency Streak Widget */}
                  <div className={`p-5 sm:p-6 mb-8 rounded-2xl transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0F1117] border border-[#1D2230]' : 'bg-[#F7F8FB] border border-[#F1F3F9]'}`}>
                     <div className="flex justify-between items-start sm:items-center mb-4">
                       <div>
                         <span className={`block text-xs uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#9CA3AF]'}`}>Consistency Grid</span>
                         <p className={`text-[10px] uppercase tracking-widest mt-1 ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>
                           {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                         </p>
                       </div>
                       {calculateStreak() > 0 && <span className={`text-[10px] sm:text-xs font-medium px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-500/10 text-orange-600'}`}>🔥 {calculateStreak()} Day Streak</span>}
                     </div>
                     <div className="flex flex-wrap gap-2 sm:gap-2.5 mt-2">{getLifeGrid()}</div>
                  </div>

                  {/* Mood Grid */}
                  <div className={`p-5 mb-6 sm:mb-8 rounded-2xl transition-colors duration-300 overflow-x-auto ${theme === 'dark' ? 'bg-[#0F1117] border border-[#1D2230]' : 'bg-[#F7F8FB] border border-[#F1F3F9]'}`}>
                      <span className={`block text-xs uppercase tracking-widest font-medium mb-4 ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#9CA3AF]'}`}>State of Mind</span>
                      <div className="flex sm:grid sm:grid-cols-8 gap-2 min-w-max">
                        {moodOptions.map(m => (
                          <div key={m.id} className="relative flex justify-center group">
                            <button onClick={() => setMood(m.id)} className={`flex justify-center items-center w-12 h-12 rounded-xl transition-all duration-300 border bg-transparent ${mood === m.id ? (theme === 'dark' ? 'bg-[#5EEAD4]/10 border-[#5EEAD4] opacity-100 scale-105' : 'bg-[#6366F1]/10 border-[#6366F1] opacity-100 scale-105') : (theme === 'dark' ? `border-transparent opacity-50 hover:opacity-100 ${m.themeDark}` : `border-transparent opacity-60 hover:opacity-100 ${m.themeLight}`)}`}><span className="text-2xl filter drop-shadow-sm">{m.icon}</span></button>
                            <span className={`absolute -top-8 px-2 py-1 text-[10px] uppercase tracking-wider rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50 ${theme === 'dark' ? 'bg-[#2A3040] text-white shadow-lg' : 'bg-gray-800 text-white shadow-md'}`}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                  </div>

                  {/* Reflection Journal Input Area */}
                  <div className="relative z-30">
                    <textarea value={reflectionInput} onChange={(e) => setReflectionInput(e.target.value)} placeholder="What is on your mind today? Type your reflection here..." disabled={isAnalyzing} className={`w-full min-h-[140px] sm:min-h-[160px] p-4 sm:p-6 rounded-2xl resize-y transition-all duration-500 outline-none font-['Source_Serif_4'] text-base sm:text-lg ${theme === 'dark' ? 'bg-[#0F1117] border border-[#2A3040] text-[#E6EAF2] placeholder-[#4B5563] focus:border-[#5EEAD4]/50 focus:shadow-[0_0_20px_rgba(94,234,212,0.05)]' : 'bg-[#F7F8FB] border border-[#E3E6EF] text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#6366F1]/50 focus:shadow-[0_4px_20px_rgba(99,102,241,0.05)]'}`} />
                    <div className="flex justify-end mt-4">
                      <button onClick={() => submitReflection()} disabled={isAnalyzing || !reflectionInput.trim()} className={`px-4 sm:px-6 py-3 rounded-xl text-sm sm:text-base font-medium tracking-wide transition-all duration-500 flex items-center gap-2 ${isAnalyzing ? 'opacity-70 cursor-wait' : 'hover:scale-105 active:scale-95 cursor-pointer'} ${theme === 'dark' ? 'bg-gradient-to-r from-[#5EEAD4] to-[#A78BFA] text-[#0F1117] hover:shadow-[0_0_20px_rgba(94,234,212,0.3)]' : 'bg-gradient-to-r from-[#6366F1] to-[#22D3EE] text-white hover:shadow-[0_8px_20px_rgba(99,102,241,0.3)]'} disabled:grayscale disabled:hover:scale-100 disabled:shadow-none`}>
                        {isAnalyzing ? <><div className="w-4 h-4 rounded-full border-2 border-[#0F1117] dark:border-white border-t-transparent animate-spin"></div>Analyzing...</> : 'Process Reflection'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- DEEP ANALYSIS SECTION --- */}
                {reflectionsHistory.length >= 2 && (
                  <div className="w-full mt-10 sm:mt-12 mb-10 sm:mb-12 relative z-20">
                     <div className="flex justify-between items-center mb-6 px-2">
                        <h3 className={`text-sm uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#9CA3AF]'}`}>Nexus Deep Analysis</h3>
                        <button 
                          onClick={handleGenerateAnalysis}
                          disabled={isAnalysisLoading}
                          className={`text-[10px] px-4 py-2 rounded-full uppercase tracking-widest font-medium transition-all duration-300 ${
                            isAnalysisLoading ? 'opacity-50 cursor-wait' : 'hover:scale-105 active:scale-95 cursor-pointer'
                          } ${theme === 'dark' ? 'bg-[#2A3040] text-[#5EEAD4] hover:bg-[#5EEAD4] hover:text-[#0F1117]' : 'bg-[#E3E6EF] text-[#6366F1] hover:bg-[#6366F1] hover:text-white'}`}
                        >
                          {isAnalysisLoading ? 'Extracting Insights...' : 'Run Deep Analysis'}
                        </button>
                     </div>

                     {analysisError && (
                       <p className="text-rose-500 text-xs text-center mb-4">{analysisError}</p>
                     )}

                     {analysisData && !isAnalysisLoading && (
                       <div className="flex flex-col gap-4 sm:gap-6 animate-fade-in-up">
                          {/* SWOT GRID */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-emerald-500 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-emerald-500 mb-2">Strengths</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.swot.strengths)} />
                             </div>
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-orange-500 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-orange-500 mb-2">Weaknesses</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.swot.weaknesses)} />
                             </div>
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-cyan-500 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-cyan-500 mb-2">Opportunities</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.swot.opportunities)} />
                             </div>
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-indigo-500 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-indigo-500 mb-2">Threats</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.swot.threats)} />
                             </div>
                          </div>

                          {/* WWW & EBI GRID */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-teal-400 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-teal-400 mb-2">What Went Well</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.www_ebi.what_went_well)} />
                             </div>
                             <div className={`p-5 sm:p-6 rounded-2xl border-l-4 border-l-violet-400 ${theme === 'dark' ? 'bg-[#161A23]/80 border-t border-r border-b border-[#2A3040]' : 'bg-white border-t border-r border-b border-[#E3E6EF] shadow-sm'}`}>
                                <span className="block text-[10px] sm:text-xs uppercase tracking-widest font-medium text-violet-400 mb-2">Even Better If</span>
                                <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(analysisData.www_ebi.even_better_if)} />
                             </div>
                          </div>

                          {/* 5 WHYS TIMELINE */}
                          <div className={`p-5 sm:p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#161A23]/80 border border-[#2A3040]' : 'bg-white border border-[#E3E6EF] shadow-sm'}`}>
                             <span className={`block text-[10px] sm:text-xs uppercase tracking-widest font-medium mb-6 ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#9CA3AF]'}`}>5 Whys Root Cause Analysis</span>
                             <div className={`flex flex-col gap-5 pl-4 border-l-2 border-dashed ${theme === 'dark' ? 'border-[#5EEAD4]/30' : 'border-[#6366F1]/30'}`}>
                                {analysisData.five_whys.map((why: string, idx: number) => (
                                   <div key={idx} className="relative">
                                      <span className={`absolute -left-[23px] top-1 sm:top-1.5 w-2.5 h-2.5 rounded-full ${theme === 'dark' ? 'bg-[#5EEAD4] shadow-[0_0_8px_rgba(94,234,212,0.6)]' : 'bg-[#6366F1] shadow-[0_0_8px_rgba(99,102,241,0.6)]'}`}></span>
                                      <p className={`text-sm sm:text-base leading-relaxed ${theme === 'dark' ? 'text-[#E6EAF2]' : 'text-[#1F2937]'}`} dangerouslySetInnerHTML={formatMarkdownText(why)} />
                                   </div>
                                ))}
                             </div>
                          </div>

                          {/* INSPIRATIONAL QUOTE */}
                          <div className="mt-4 mb-4 px-4 text-center">
                             <p className={`font-['Source_Serif_4'] text-lg sm:text-xl italic ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>
                                "{analysisData.quote}"
                             </p>
                          </div>
                       </div>
                     )}
                  </div>
                )}

                {/* --- REFLECTION HISTORY TIMELINE --- */}
                {reflectionsHistory.length > 0 && (
                  <div id="memory-log-section" className="w-full mt-8 animate-fade-in-up relative z-20">
                    <div className="flex justify-between items-end mb-6 px-2">
                      <h3 className={`text-sm uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#9CA3AF]'}`}>
                        {selectedDateFilter ? `Memory Log: ${new Date(selectedDateFilter).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Nexus Memory Log'}
                      </h3>
                      {selectedDateFilter && (
                        <button 
                          onClick={() => setSelectedDateFilter(null)}
                          className={`text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest font-medium transition-all duration-300 ${theme === 'dark' ? 'bg-[#2A3040] text-[#A4A9B6] hover:text-white' : 'bg-[#E3E6EF] text-[#6B7280] hover:text-[#1F2937]'}`}
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-6">
                      {displayedReflections.length === 0 && selectedDateFilter ? (
                         <div className={`p-10 text-center rounded-3xl border border-dashed ${theme === 'dark' ? 'border-[#2A3040] text-[#6B7280]' : 'border-[#E3E6EF] text-[#9CA3AF]'}`}>
                           <p className="italic text-sm">No memories recorded on this day.</p>
                         </div>
                      ) : (
                        displayedReflections.map((ref) => {
                          const insightData = parseInsight(ref.ai_insight);
                          const refDate = new Date(ref.created_at);
                          const today = new Date();
                          const isToday = refDate.toDateString() === today.toDateString();
                          
                          return (
                          <div key={ref.id} className={`p-5 sm:p-8 rounded-3xl transition-all duration-300 relative group ${theme === 'dark' ? 'bg-[#161A23] border border-[#2A3040] hover:border-[#5EEAD4]/30' : 'bg-white border border-[#E3E6EF] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#6366F1]/30'}`}>
                            {isToday && (
                              <div className={`absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-1 sm:gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>
                                {editingRefId !== ref.id && <button onClick={() => { setEditingRefId(ref.id); setEditContent(ref.content); }} className="p-2 hover:text-[#5EEAD4] transition-colors" title="Edit"><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>}
                                <button onClick={() => handleDeleteReflection(ref.id)} className="p-2 hover:text-rose-500 transition-colors" title="Delete"><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mb-4 opacity-80">
                              {ref.mood && <span className="text-xl sm:text-2xl">{getMoodIcon(ref.mood)}</span>}
                              <span className={`text-[10px] sm:text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>{refDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                            
                            {editingRefId === ref.id ? (
                              <div className="mb-6">
                                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`w-full min-h-[120px] p-4 rounded-xl resize-y outline-none font-['Source_Serif_4'] text-base sm:text-lg ${theme === 'dark' ? 'bg-[#0F1117] border border-[#5EEAD4]/50 text-[#E6EAF2]' : 'bg-[#F7F8FB] border border-[#6366F1]/50 text-[#1F2937]'}`} />
                                <div className="flex justify-end gap-2 mt-3">
                                  <button onClick={() => setEditingRefId(null)} className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium ${theme === 'dark' ? 'hover:bg-[#2A3040]' : 'hover:bg-[#E3E6EF]'}`}>Cancel</button>
                                  <button onClick={() => handleSaveEdit(ref.id)} className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-[#0F1117] ${theme === 'dark' ? 'bg-[#5EEAD4]' : 'bg-[#6366F1] text-white'}`}>Save Updates</button>
                                </div>
                              </div>
                            ) : (
                              <p className="font-['Source_Serif_4'] text-base sm:text-lg leading-relaxed mb-6 whitespace-pre-wrap pr-8 sm:pr-10" dangerouslySetInnerHTML={formatMarkdownText(ref.content)}></p>
                            )}

                            {ref.ai_insight && (
                              <div className={`p-4 sm:p-5 rounded-2xl relative overflow-hidden ${theme === 'dark' ? 'bg-[#0F1117]/80' : 'bg-[#F7F8FB]'}`}>
                                <div className={`absolute top-0 left-0 w-1 h-full ${theme === 'dark' ? 'bg-[#5EEAD4]' : 'bg-[#6366F1]'}`}></div>
                                <span className={`block text-[10px] sm:text-xs uppercase tracking-widest font-medium mb-3 ${theme === 'dark' ? 'text-[#5EEAD4]' : 'text-[#6366F1]'}`}>Nexus Insight</span>
                                <p className={`text-sm sm:text-base leading-relaxed mb-4 ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#4B5563]'}`} dangerouslySetInnerHTML={formatMarkdownText(insightData.content)}></p>
                                
                                {insightData.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {insightData.tags.map((tag, idx) => (
                                      <span key={idx} className={`text-[10px] sm:text-xs px-3 py-1 rounded-full font-medium tracking-wide border ${theme === 'dark' ? 'bg-[#5EEAD4]/10 text-[#5EEAD4] border-[#5EEAD4]/20' : 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20'}`}>{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })
                      )}
                    </div>

                    {!selectedDateFilter && visibleCount < reflectionsHistory.length && (
                      <div className="mt-8 text-center">
                        <button onClick={() => setVisibleCount(v => v + 2)} className={`px-6 py-3 rounded-full text-xs sm:text-sm font-medium tracking-wider transition-all duration-300 border ${theme === 'dark' ? 'border-[#2A3040] text-[#A4A9B6] hover:bg-[#1D2230] hover:text-[#5EEAD4] hover:border-[#5EEAD4]' : 'border-[#E3E6EF] text-[#6B7280] hover:bg-[#F1F3F9] hover:text-[#6366F1] hover:border-[#6366F1]'}`}>Unlock Deeper Memory</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-t-transparent animate-spin mb-4 ${theme === 'dark' ? 'border-[#5EEAD4]' : 'border-[#6366F1]'}`}></div>
                <p className="font-light tracking-widest text-xs sm:text-sm uppercase">Loading Nexus</p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md animate-fade-in-up relative z-20 px-4 sm:px-0">
             <div className="text-center mb-10 sm:mb-12 mt-8 sm:mt-0">
                <h1 className="text-4xl sm:text-5xl font-light tracking-widest mb-4 drop-shadow-sm">VISCORA <span className={`font-normal ${theme === 'dark' ? 'text-[#5EEAD4]' : 'text-[#6366F1]'}`}>NEXUS</span></h1>
                <p className={`font-light tracking-wide text-sm sm:text-base ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#6B7280]'}`}>{theme === 'dark' ? 'Deep night sky, quiet thinking.' : 'Sunlight, calm thinking, elegant.'}</p>
             </div>
            
            <div className={`p-6 sm:p-10 rounded-3xl transition-all duration-500 ${theme === 'dark' ? 'bg-[#161A23] border border-[#2A3040] shadow-[0_8px_30px_rgba(0,0,0,0.45)]' : 'bg-white border border-[#E3E6EF] shadow-[0_10px_40px_rgba(0,0,0,0.06)]'}`}>
              <h2 className="text-xl sm:text-2xl font-light mb-6 sm:mb-8 text-center tracking-wide">{isLoginView ? "Welcome Back" : "Begin Your Journey"}</h2>
              {errorMsg && <div className={`p-4 mb-6 sm:mb-8 rounded-xl text-xs sm:text-sm animate-fade-in-up ${theme === 'dark' ? 'bg-rose-900/20 text-rose-400 border border-rose-900/50' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{errorMsg}</div>}

              <form onSubmit={handleAuth} className="flex flex-col gap-4 sm:gap-5">
                {!isLoginView && (
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                    <input type="text" placeholder="First Name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-sm sm:text-base transition-all duration-300 border-none focus:ring-2 focus:outline-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-white placeholder-[#6B7280] shadow-inner' : 'bg-[#F7F8FB] focus:ring-[#6366F1]/50 text-[#1F2937] placeholder-[#9CA3AF]'}`} />
                    <input type="text" placeholder="Last Name" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-sm sm:text-base transition-all duration-300 border-none focus:ring-2 focus:outline-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-white placeholder-[#6B7280] shadow-inner' : 'bg-[#F7F8FB] focus:ring-[#6366F1]/50 text-[#1F2937] placeholder-[#9CA3AF]'}`} />
                  </div>
                )}
                
                <input type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-sm sm:text-base transition-all duration-300 border-none focus:ring-2 focus:outline-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-white placeholder-[#6B7280] shadow-inner' : 'bg-[#F7F8FB] focus:ring-[#6366F1]/50 text-[#1F2937] placeholder-[#9CA3AF]'}`} />
                <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-sm sm:text-base transition-all duration-300 border-none focus:ring-2 focus:outline-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-white placeholder-[#6B7280] shadow-inner' : 'bg-[#F7F8FB] focus:ring-[#6366F1]/50 text-[#1F2937] placeholder-[#9CA3AF]'}`} />
                
                {!isLoginView && (
                  <div className="relative">
                    <select value={persona} onChange={(e) => setPersona(e.target.value)} className={`w-full p-3.5 sm:p-4 rounded-xl text-sm sm:text-base transition-all duration-300 border-none focus:ring-2 focus:outline-none appearance-none ${theme === 'dark' ? 'bg-[#0F1117] focus:ring-[#5EEAD4]/50 text-[#E6EAF2] shadow-inner' : 'bg-[#F7F8FB] focus:ring-[#6366F1]/50 text-[#1F2937]'}`}>
                      <option value="guest">Select Persona (Optional)</option>
                      <option value="student">Student</option>
                      <option value="homemaker">Homemaker</option>
                      <option value="professional">Professional</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><svg className={`w-4 h-4 ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                  </div>
                )}
                
                <button type="submit" className={`w-full mt-2 sm:mt-4 p-3.5 sm:p-4 rounded-xl font-medium tracking-wide transition-all duration-500 hover:scale-[1.02] active:scale-95 ${theme === 'dark' ? 'bg-gradient-to-r from-[#5EEAD4] to-[#A78BFA] text-[#0F1117] hover:shadow-[0_0_25px_rgba(94,234,212,0.25)]' : 'bg-gradient-to-r from-[#6366F1] to-[#22D3EE] text-white hover:shadow-[0_8px_25px_rgba(99,102,241,0.25)]'}`}>{isLoginView ? "Access Interface" : "Initialize Profile"}</button>
              </form>

              <div className="mt-6 sm:mt-8 text-center">
                <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[#A4A9B6]' : 'text-[#6B7280]'}`}>{isLoginView ? "New to the Nexus? " : "Returning traveler? "} <button type="button" onClick={() => { setIsLoginView(!isLoginView); setErrorMsg(""); }} className={`font-medium transition-colors duration-300 ml-1 ${theme === 'dark' ? 'text-[#5EEAD4] hover:text-white' : 'text-[#6366F1] hover:text-[#1F2937]'}`}>{isLoginView ? "Initialize here." : "Access here."}</button></p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- BEAUTIFUL FOOTER --- */}
      <footer className={`w-full py-8 mt-auto relative z-10 border-t backdrop-blur-sm transition-colors duration-500 ${
        theme === 'dark' ? 'border-white/5 bg-[#0F1117]/50' : 'border-black/5 bg-[#F7F8FB]/50'
      }`}>
        <div className="flex flex-col items-center justify-center gap-3">
           <p className={`text-xs tracking-widest uppercase font-medium ${theme === 'dark' ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>
            Viscora Nexus © {new Date().getFullYear()}
           </p>
           <a
             href="https://github.com/SrijanSingh9/Viscora-Nexus"
             target="_blank"
             rel="noopener noreferrer"
             className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 ${
               theme === 'dark' ? 'text-[#A4A9B6] hover:text-[#5EEAD4]' : 'text-[#4B5563] hover:text-[#6366F1]'
             }`}
           >
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
               <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
             </svg>
             View on GitHub
           </a>
        </div>
      </footer>
    </div>
  );
}

export default App;