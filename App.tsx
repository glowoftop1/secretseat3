/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Shuffle, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Download, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Lock, 
  X,
  ChevronRight,
  UserCircle2,
  Settings2,
  Slash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type ConstraintType = 'separate' | 'together' | 'fixed';

interface Student {
  id: string;
  name: string;
  number?: number;
}

interface Constraint {
  id: string;
  type: ConstraintType;
  studentIds: string[]; 
  fixedIndex?: number; 
}

type ViewMode = 'student' | 'teacher';

// --- Utils ---

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  // --- State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(6);
  const [emptyCells, setEmptyCells] = useState<number[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isSecretMode, setIsSecretMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [placement, setPlacement] = useState<(string | null)[]>([]);
  const [isCoutingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // New student input
  const [newStudentName, setNewStudentName] = useState('');

  // UI state
  const [isEditEmptyMode, setIsEditEmptyMode] = useState(false);

  // --- Backend Check ---
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => console.log('Server Status:', data))
      .catch(err => console.error('Server offline or invalid:', err));
  }, []);

  // --- Derived State ---
  const gridSize = rows * cols;
  const availableSeatsCount = gridSize - emptyCells.length;

  // --- Constants ---
  const guideSteps = [
    { title: "학생 명단 입력", text: "좌측 관리 패널에서 학생 이름을 추가하거나 아래 '샘플 채우기'를 눌러 테스트해보세요." },
    { title: "교실 배치 설정", text: "상단 패널에서 줄/열을 맞추고, '없는 자리 설정' 버튼을 활성화하여 복도 등을 클릭해 제외하세요." },
    { title: "시크릿 제약 조건", text: "좌측 하단 'SECRET MODE'를 켜고 '따로/함께/고정' 규칙을 설정하세요. 학생에겐 보이지 않습니다!" },
    { title: "배정 및 저장", text: "중앙의 '자리 뽑기!' 버튼을 눌러 배정하고, 'HWP 다운로드' 버튼으로 결과를 저장하세요." }
  ];

  // --- Handlers ---

  const handleAddStudent = () => {
    if (!newStudentName.trim()) return;
    const names = newStudentName.split(/[\s,]+/).filter(n => n.trim());
    const newOnes = names.map(name => ({ id: generateId(), name }));
    setStudents([...students, ...newOnes]);
    setNewStudentName('');
  };

  const handleAutoFill = () => {
    const count = parseInt(prompt("몇 명의 샘플 학생을 추가할까요?", "24") || "0");
    if (count > 0) {
      const autoStudents = Array.from({ length: count }, (_, i) => ({
        id: generateId(),
        name: `학생 ${i + 1}`,
        number: i + 1
      }));
      setStudents(autoStudents);
    }
  };

  const handleRemoveStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setConstraints(prev => prev.filter(c => !c.studentIds.includes(id)));
  };

  const toggleEmptyCell = (index: number) => {
    if (!isEditEmptyMode) return;
    if (emptyCells.includes(index)) {
      setEmptyCells(emptyCells.filter(i => i !== index));
    } else {
      setEmptyCells([...emptyCells, index]);
    }
  };

  const addConstraint = (type: ConstraintType) => {
    if (type === 'fixed') {
      const name = prompt("고정할 학생 이름 (이미 명단에 있는 이름)");
      const index = parseInt(prompt("좌석 번호 (1번부터 시작)") || "1") - 1;
      const student = students.find(s => s.name === name);
      if (student && index >= 0 && index < gridSize) {
        setConstraints([...constraints, { id: generateId(), type, studentIds: [student.id], fixedIndex: index }]);
      }
    } else {
      const name1 = prompt("첫 번째 학생 이름");
      const name2 = prompt("두 번째 학생 이름");
      const s1 = students.find(s => s.name === name1);
      const s2 = students.find(s => s.name === name2);
      if (s1 && s2) {
        setConstraints([...constraints, { id: generateId(), type, studentIds: [s1.id, s2.id] }]);
      } else {
        alert("학생 이름을 정확히 입력해주세요.");
      }
    }
  };

  const handleReset = () => {
    if (confirm("모든 상태를 초기화하시겠습니까?")) {
      setStudents([]);
      setRows(6);
      setCols(6);
      setEmptyCells([]);
      setConstraints([]);
      setPlacement([]);
    }
  };

  // --- Logic ---

  const shufflePlacement = () => {
    if (students.length > availableSeatsCount) {
      alert("학생 수가 가용 좌석보다 많습니다!");
      return;
    }
    setIsCountingDown(true);
    setCountdown(3);
  };

  useEffect(() => {
    let timer: number;
    if (isCoutingDown && countdown > 0) {
      timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (isCoutingDown && countdown === 0) {
      runAlgorithm();
      setIsCountingDown(false);
    }
    return () => clearTimeout(timer);
  }, [isCoutingDown, countdown]);

  const runAlgorithm = () => {
    const validIndices = Array.from({ length: gridSize }, (_, i) => i).filter(i => !emptyCells.includes(i));
    let initialPlacement: (string | null)[] = new Array(gridSize).fill(null);
    let remaining = [...students];

    // Fixed
    constraints.filter(c => c.type === 'fixed').forEach(c => {
      const s = remaining.find(st => st.id === c.studentIds[0]);
      if (s && c.fixedIndex !== undefined && !emptyCells.includes(c.fixedIndex)) {
        initialPlacement[c.fixedIndex] = s.id;
        remaining = remaining.filter(st => st.id !== s.id);
      }
    });

    const attempt = () => {
      const availableIndices = validIndices.filter(i => initialPlacement[i] === null);
      const shuffledIndices = [...availableIndices].sort(() => Math.random() - 0.5);
      const shuffledStudents = [...remaining].sort(() => Math.random() - 0.5);
      const temp = [...initialPlacement];
      shuffledStudents.forEach((s, idx) => temp[shuffledIndices[idx]] = s.id);

      return constraints.every(c => {
        if (c.type === 'fixed') return true;
        const i1 = temp.indexOf(c.studentIds[0]);
        const i2 = temp.indexOf(c.studentIds[1]);
        if (i1 === -1 || i2 === -1) return true;
        const r1 = Math.floor(i1 / cols), c1 = i1 % cols;
        const r2 = Math.floor(i2 / cols), c2 = i2 % cols;
        const dR = Math.abs(r1 - r2), dC = Math.abs(c1 - c2);
        if (c.type === 'separate') return dR > 1 || dC > 1;
        if (c.type === 'together') return dR === 0 && dC === 1;
        return true;
      }) ? temp : null;
    };

    let result = null;
    for (let i = 0; i < 500; i++) {
       result = attempt();
       if (result) break;
    }
    
    if (!result) {
       const fallbackIndices = validIndices.filter(i => initialPlacement[i] === null).sort(() => Math.random() - 0.5);
       const fallback = [...initialPlacement];
       remaining.sort(() => Math.random() - 0.5).forEach((s, i) => fallback[fallbackIndices[i]] = s.id);
       setPlacement(fallback);
    } else {
       setPlacement(result);
    }
  };

  const handleDownloadHWP = () => {
    // Basic HWP Export Logic (HTML Mock)
    const displayIndices = viewMode === 'teacher' ? [...placement].reverse() : placement;
    let tableHtml = `<table border="1" style="width:100%; border-collapse:collapse; text-align:center;">`;
    for (let r = 0; r < rows; r++) {
      tableHtml += "<tr>";
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const s = students.find(st => st.id === displayIndices[idx]);
        tableHtml += `<td style="height:50px;">${s ? s.name : (emptyCells.includes(idx) ? 'X' : '')}</td>`;
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</table>";
    const blob = new Blob([`<html><body><h1 style="text-align:center;">자리 배치표 (${viewMode==='teacher'?'교탁용':'게시용'})</h1>${tableHtml}</body></html>`], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `자리배치_${new Date().getTime()}.hwp`; a.click();
  };

  return (
    <div className="min-h-screen bg-[#f0f6ff] text-[#4a5568] font-sans p-6 md:p-10 flex flex-col items-center">
      
      {/* Title */}
      <h1 className="text-4xl md:text-5xl font-black text-[#2b6cb0] mb-6 flex items-center justify-center gap-4">
        시크릿 <span className="text-[#3182ce]">{gridSize}자리</span> 뽑기
      </h1>

      {/* View Switcher */}
      <div className="flex bg-white/60 p-1 rounded-xl shadow-inner border border-white mb-8">
        <button 
          onClick={() => setViewMode('student')}
          className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'student' ? 'bg-[#4299e1] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          게시용
        </button>
        <button 
          onClick={() => setViewMode('teacher')}
          className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'teacher' ? 'bg-[#4299e1] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          교탁용
        </button>
      </div>

      {/* Grid Control Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-sm border border-blue-50 mb-8 space-y-6">
        <div className="flex flex-col gap-4">
           {[["열", cols, setCols], ["행", rows, setRows]].map(([label, val, setter]) => (
            <div key={label as string} className="flex items-center gap-4 px-4">
              <span className="text-xs font-bold text-[#3182ce] whitespace-nowrap">{label as string} {val as number}개</span>
              <input 
                type="range" min="2" max="10" value={val as number} 
                onChange={(e) => (setter as any)(parseInt(e.target.value))} 
                className="flex-1 accent-[#4299e1] cursor-pointer h-1.5 bg-blue-50 rounded-full appearance-none"
              />
            </div>
           ))}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
        <button 
          onClick={() => setIsEditEmptyMode(!isEditEmptyMode)}
          className={`px-8 py-3 rounded-full text-xs font-bold transition-all border shadow-sm ${isEditEmptyMode ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-white border-blue-100 text-blue-500 hover:bg-blue-50'}`}
        >
          {isEditEmptyMode ? '설정 완료' : '없는 자리 설정'}
        </button>

        <button 
          onClick={shufflePlacement}
          disabled={isCoutingDown || students.length === 0}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center p-2 text-center leading-tight ring-8 ring-white disabled:grayscale"
        >
          자리 뽑기!
        </button>

        <button 
          onClick={handleReset}
          className="px-8 py-3 rounded-full border border-red-200 text-red-500 text-xs font-bold bg-white hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
        >
          <RotateCcw size={14} /> ↺ 초기화
        </button>

        <button 
          onClick={handleDownloadHWP}
          className="px-8 py-3 rounded-full bg-slate-200/80 text-slate-500 text-xs font-bold hover:bg-slate-300 transition-all shadow-sm flex items-center gap-2"
        >
          📥 HWP 다운로드 (게시용)
        </button>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Management */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-blue-50 flex flex-col min-h-[500px]">
            <h2 className="text-sm font-black text-[#3182ce] mb-6 flex items-center gap-2">
              <Users size={18} /> 학생 명단 ({students.length})
            </h2>

            <div className="flex gap-2 mb-6">
              <input 
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                placeholder="이름 입력"
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              />
              <button 
                onClick={handleAddStudent}
                className="bg-[#4299e1] text-white p-3 rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-6">
              <AnimatePresence>
                {students.map((s, idx) => (
                  <motion.div key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group flex items-center justify-between p-3 px-4 bg-slate-50 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 transition-all">
                    <span className="text-xs font-bold text-slate-600">{s.name}</span>
                    <button onClick={() => handleRemoveStudent(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><X size={14} /></button>
                  </motion.div>
                ))}
                {students.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                    <UserCircle2 size={48} strokeWidth={1} />
                    <p className="text-[10px] mt-2 font-bold">학생을 추가해주세요</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={handleAutoFill}
              className="w-full py-4 border-2 border-dashed border-blue-100 rounded-2xl text-[10px] font-bold text-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
              # 번호로 샘플 채우기
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Settings2 size={16} className="text-slate-300" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Secret Mode</span>
            </div>
            <button 
              onClick={() => setIsSecretMode(!isSecretMode)}
              className={`w-10 h-6 rounded-full transition-all relative ${isSecretMode ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isSecretMode ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Right Column: Grid */}
        <div className="lg:col-span-9 bg-white/60 p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-white flex flex-col items-center relative">
          
          {/* Main Action Overlays */}
          <AnimatePresence>
            {isCoutingDown && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md rounded-[3.5rem]">
                <motion.span key={countdown} initial={{ scale: 0 }} animate={{ scale: 1.5 }} exit={{ scale: 3, opacity: 0 }} className="text-[12rem] font-black text-blue-500 drop-shadow-2xl">
                  {countdown}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chalkboard Pill */}
          <div className="bg-white px-10 py-3 rounded-2xl border border-blue-100 shadow-sm mb-12">
            <span className="text-sm font-black text-blue-400 tracking-[0.4em]">교 탁</span>
          </div>

          {/* Seating Grid */}
          <div 
            className={`grid transition-all duration-1000 ease-in-out ${viewMode === 'teacher' ? 'rotate-180' : ''}`}
            style={{ 
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '16px',
              width: '100%'
            }}
          >
            {Array.from({ length: gridSize }).map((_, idx) => {
              const s = students.find(st => st.id === (viewMode === 'student' ? placement[idx] : [...placement].reverse()[idx]));
              const isEmpty = emptyCells.includes(idx);
              
              return (
                <div 
                  key={idx} 
                  onClick={() => toggleEmptyCell(idx)}
                  className={`
                    aspect-[5/4] rounded-2xl border-2 flex flex-col items-center justify-center p-2 relative group transition-all
                    ${isEmpty 
                      ? 'bg-slate-100/50 border-slate-200 ring-2 ring-transparent' 
                      : s ? 'bg-white border-blue-50 shadow-sm' : 'bg-white/80 border-slate-100'
                    }
                    ${isEditEmptyMode ? 'hover:border-amber-300 hover:ring-8 hover:ring-amber-50 cursor-pointer' : ''}
                  `}
                >
                  {isEmpty ? (
                    <span className="text-slate-300 font-black text-xl">X</span>
                  ) : s ? (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                       <span className={`font-black text-[#2d3748] block transition-transform ${viewMode === 'teacher' ? 'rotate-180' : ''} ${cols > 8 ? 'text-[10px]' : 'text-sm md:text-lg'}`}>
                        {s.name}
                       </span>
                    </motion.div>
                  ) : (
                    <span className={`text-[#cbd5e0] font-black text-xl ${viewMode === 'teacher' ? 'rotate-180' : ''}`}>?</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Constraints Panel (Secret Only) */}
          <AnimatePresence>
            {isSecretMode && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 flex flex-wrap gap-4 border-t border-blue-50 pt-8 w-full justify-center">
                <button onClick={() => addConstraint('separate')} className="px-6 py-2 bg-red-50 text-red-500 rounded-full text-[10px] font-black border border-red-100 shadow-sm hover:bg-red-100 transition-all">❌ 따로</button>
                <button onClick={() => addConstraint('together')} className="px-6 py-2 bg-green-50 text-green-500 rounded-full text-[10px] font-black border border-green-100 shadow-sm hover:bg-green-100 transition-all">🤝 함께</button>
                <button onClick={() => addConstraint('fixed')} className="px-6 py-2 bg-purple-50 text-purple-500 rounded-full text-[10px] font-black border border-purple-100 shadow-sm hover:bg-purple-100 transition-all">📍 고정</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Guide Float */}
      <button 
        onClick={() => setShowGuide(true)}
        className="fixed bottom-10 right-10 w-14 h-14 bg-white text-blue-500 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all border border-blue-50"
      >
        <HelpCircle size={28} />
      </button>

      {/* Guide Modal (Minimal) */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 border border-blue-50">
              <h3 className="text-lg font-black text-blue-600 mb-2">{guideSteps[guideStep].title}</h3>
              <p className="text-xs font-bold text-slate-400 mb-8 leading-relaxed">{guideSteps[guideStep].text}</p>
              <div className="flex gap-1 mb-8">
                {guideSteps.map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${guideStep === i ? 'w-6 bg-blue-500' : 'w-2 bg-blue-100'}`} />)}
              </div>
              <button 
                onClick={() => guideStep < 3 ? setGuideStep(guideStep + 1) : setShowGuide(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all"
              >
                {guideStep < 3 ? '다음' : '확인'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-20 pb-10 text-center opacity-30 text-[10px] font-bold uppercase tracking-widest">
        © 2026 Secret Seat Randomizer | Premium Educational Tool
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
