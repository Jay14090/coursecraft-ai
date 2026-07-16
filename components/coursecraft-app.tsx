"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Command,
  FileText,
  Download,
  Flame,
  Gauge,
  GraduationCap,
  GitBranch,
  Headphones,
  HelpCircle,
  Home,
  History,
  Languages,
  Library,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { type CSSProperties, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  type Chapter,
  type ChatResponse,
  type CourseDetail,
  type CourseSummary,
  type DashboardMetrics,
  type Flashcard,
  type CourseDiagram,
  type CourseSummaryTool,
  type LearningHistory,
  type MindMap,
  type QuizPayload,
  type SearchResult,
  coursecraftApi,
} from "@/lib/api";
import { createSamplePdf } from "@/lib/sample-pdf";

type View = "dashboard" | "courses" | "course" | "ai-lab" | "history";
type UploadStage = "idle" | "selected" | "uploading" | "generating" | "ready";
type UtilityPanel = "help" | "settings" | "notifications" | "plan" | null;

const accents = ["violet", "amber", "cyan", "rose"];

function messageFrom(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function pluralize(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function relativeDate(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  if (difference < 60_000) return "just now";
  if (difference < 3_600_000) return `${Math.floor(difference / 60_000)} min ago`;
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Logo() {
  return <div className="brand" aria-label="CourseCraft home"><span className="brand-mark"><span>c</span></span><span className="brand-name">coursecraft<span>.</span></span></div>;
}

function ProgressRing({ value, size = 46 }: { value: number; size?: number }) {
  const style = { "--progress": `${value * 3.6}deg`, "--ring-size": `${size}px` } as CSSProperties;
  return <span className="progress-ring" style={style}><strong>{value}%</strong></span>;
}

function CourseCover({ course, compact = false, index = 0 }: { course: CourseSummary; compact?: boolean; index?: number }) {
  return (
    <div className={`course-cover ${accents[index % accents.length]} ${compact ? "compact" : ""}`}>
      <div className="cover-grid" />
      <span className="cover-chip">{course.difficulty}</span>
      <div className="cover-orbit"><span /><span /><span /></div>
      {!compact && <div className="cover-caption">coursecraft original</div>}
    </div>
  );
}

function Sidebar({ view, courseCount, mobileOpen, onView, onClose, onUtility }: {
  view: View;
  courseCount: number;
  mobileOpen: boolean;
  onView: (view: View) => void;
  onClose: () => void;
  onUtility: (panel: UtilityPanel) => void;
}) {
  const nav = [
    { id: "dashboard" as const, label: "Overview", icon: Home },
    { id: "courses" as const, label: "My courses", icon: Library, badge: String(courseCount) },
    { id: "course" as const, label: "Learning room", icon: BookOpen },
    { id: "ai-lab" as const, label: "AI studio", icon: Sparkles, badge: "New" },
    { id: "history" as const, label: "Learning history", icon: History },
  ];
  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><Logo /><button className="icon-button mobile-only" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">JP</div><div><strong>Jay&apos;s space</strong><span>Personal workspace</span></div><ChevronDown size={14} /></div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <span className="nav-label">Workspace</span>
        {nav.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { onView(item.id); onClose(); }}><Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>;
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-boost"><span><Zap size={14} fill="currentColor" /> Pro workspace</span><strong>Unlimited learning</strong><p>Generate courses and ask your library anything.</p><button onClick={() => onUtility("plan")}>View plan <ArrowRight size={14} /></button></div>
      <nav className="secondary-nav" aria-label="Secondary navigation"><button onClick={() => onUtility("help")}><HelpCircle size={17} /><span>Help & shortcuts</span></button><button onClick={() => onUtility("settings")}><Settings size={17} /><span>Settings</span></button></nav>
      <div className="user-row"><div className="avatar">JC<span /></div><div><strong>Jay Chhichhia</strong><span>jay140905@gmail.com</span></div><MoreHorizontal size={17} /></div>
    </aside>
  );
}

function Topbar({ filter, onMenu, onSearch, focusMode, onFocus, onNotifications }: {
  filter: string;
  onMenu: () => void;
  onSearch: (value: string) => void;
  focusMode: boolean;
  onFocus: () => void;
  onNotifications: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={onMenu} aria-label="Open navigation"><Menu size={19} /></button>
      <div className="global-search"><Search size={17} /><input aria-label="Search courses and lessons" placeholder="Search across your knowledge" value={filter} onChange={(event) => onSearch(event.target.value)} /><kbd><Command size={11} /> K</kbd>{filter && <button className="search-clear" onClick={() => onSearch("")} aria-label="Clear search"><X size={13} /></button>}</div>
      <div className="top-actions"><button className="icon-button notification" onClick={onNotifications} aria-label="Notifications"><Bell size={18} /><span /></button><button className={`focus-button ${focusMode ? "active" : ""}`} onClick={onFocus}><Sparkles size={15} /> {focusMode ? "Exit focus" : "Focus mode"}</button></div>
    </header>
  );
}

function StatCard({ icon: Icon, value, label, note, tone }: { icon: typeof Trophy; value: string; label: string; note: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div><strong>{value}</strong><span>{label}</span></div><small>{note}</small></article>;
}

function CourseCard({ course, index, onOpen, onDelete }: { course: CourseSummary; index: number; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="course-card">
      <button className="course-card-open" onClick={onOpen} aria-label={`Open ${course.title}`}><CourseCover course={course} index={index} /></button>
      <div className="course-card-body">
        <div className="course-card-meta"><span>{course.filename?.replace(/\.pdf$/i, "") || "Source document"}</span><button onClick={onDelete} aria-label={`Delete ${course.title}`}><Trash2 size={15} /></button></div>
        <button className="course-title-link" onClick={onOpen}><h3>{course.title}</h3></button>
        <p>{course.description}</p>
        <div className="progress-track"><span style={{ width: `${course.progress_percent}%` }} /></div>
        <div className="course-card-foot"><span>{course.progress_percent}% complete</span><span>{course.lesson_count} lessons · {formatMinutes(course.estimated_minutes)}</span></div>
      </div>
    </article>
  );
}

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (course: CourseDetail) => void }) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [depth, setDepth] = useState<"quick" | "balanced" | "mastery">("balanced");
  const [language, setLanguage] = useState("en");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<CourseDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseFile = (candidate?: File) => {
    setError("");
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) return setError("Choose a PDF document.");
    if (candidate.size > 50 * 1024 * 1024) return setError("This PDF is larger than 50 MB.");
    setFile(candidate);
    setStage("selected");
  };

  const generate = async () => {
    if (!file) return;
    setError("");
    try {
      setStage("uploading");
      setProgress(18);
      const document = await coursecraftApi.uploadDocument(file);
      setProgress(52);
      setStage("generating");
      const course = await coursecraftApi.generateCourse(document.id, depth, language);
      setProgress(100);
      setGenerated(course);
      setStage("ready");
    } catch (caught) {
      setError(messageFrom(caught));
      setStage("selected");
      setProgress(0);
    }
  };

  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="modal-backdrop">
      <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="modal-head"><div><span className="eyebrow">New learning experience</span><h2 id="upload-title">Turn a PDF into a course</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        {stage === "idle" && <>
          <button className="drop-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={drop}><span className="upload-glyph"><Upload size={23} /></span><strong>Drop your document here</strong><p>or choose a text-based PDF up to 50 MB</p><em>Research papers · books · reports · documentation</em></button>
          <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <button className="demo-document" onClick={() => chooseFile(createSamplePdf())}>
            <span><FileText size={19} /></span>
            <span><strong>Try the complete PDF flow</strong><small>Use the included 3-page retrieval guide</small></span>
            <ArrowRight size={16} />
          </button>
          <div className="upload-guidance"><CircleCheck size={16} /><span>Page citations are preserved automatically. Scanned image-only PDFs need OCR first.</span></div>
        </>}
        {stage === "selected" && file && <div className="upload-selected">
          <div className="document-preview"><FileText size={27} /><span>PDF</span></div>
          <div className="selected-copy"><span className="eyebrow">Ready to transform</span><h3>{file.name}</h3><p>{formatFileSize(file.size)} · We&apos;ll extract text, preserve page citations, build lessons, and prepare checkpoints.</p></div>
          <div className="generation-options">
            {([
              ["balanced", Gauge, "Balanced", "Clear depth and practical lessons"],
              ["quick", Zap, "Quick study", "Key ideas in the shortest path"],
              ["mastery", GraduationCap, "Deep mastery", "Detailed, rigorous coverage"],
            ] as const).map(([id, Icon, title, note]) => <button key={id} className={depth === id ? "selected" : ""} onClick={() => setDepth(id)}><Icon size={16} /><span><strong>{title}</strong><small>{note}</small></span>{depth === id && <Check size={15} />}</button>)}
          </div>
          <label className="language-select"><Languages size={16} /><span><strong>Course language</strong><small>Generate every lesson and study tool in your preferred language.</small></span><select aria-label="Course language" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option></select></label>
          {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
          <button className="primary-button wide" onClick={generate}><Sparkles size={16} /> Generate course</button>
          <button className="text-button" onClick={() => { setFile(null); setStage("idle"); }}>Choose another file</button>
        </div>}
        {(stage === "uploading" || stage === "generating") && <div className="processing-state"><div className="processing-orb"><LoaderCircle className="spin" size={25} /></div><span className="eyebrow">Course engine is working</span><h3>{stage === "uploading" ? "Reading your document" : "Designing your learning path"}</h3><p>{stage === "uploading" ? "Validating the PDF, extracting pages, and mapping source text…" : "Generating chapters, lessons, takeaways, and grounded study tools…"}</p><div className="process-bar"><span style={{ width: `${progress}%` }} /></div><div className="process-meta"><span>{progress}%</span><span>Keep this window open</span></div></div>}
        {stage === "ready" && generated && <div className="ready-state"><div className="ready-icon"><CircleCheck size={28} /></div><span className="eyebrow">Course generated</span><h3>{generated.title}</h3><p>{generated.chapters.length} chapters · {generated.summary.lesson_count} lessons · {generated.document?.page_count ?? 0} source pages</p><div className="ready-features"><span><Check size={13} /> Citations mapped to lessons</span><span><Check size={13} /> Companion and quizzes ready</span></div><button className="primary-button wide" onClick={() => onCreated(generated)}>Open course <ArrowRight size={16} /></button></div>}
        {error && stage === "idle" && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
      </section>
    </div>
  );
}

function EmptyLibrary({ onUpload }: { onUpload: () => void }) {
  return <div className="empty-library"><div><FileText size={28} /></div><span className="eyebrow">Your library is ready</span><h2>Create your first course</h2><p>Upload a text-based PDF and CourseCraft will extract, structure, and ground the learning experience in its pages.</p><button className="primary-button" onClick={onUpload}><Plus size={16} /> Create from PDF</button></div>;
}

function Dashboard({ courses, metrics, filter, onUpload, onOpenCourse, onDelete }: { courses: CourseSummary[]; metrics: DashboardMetrics | null; filter: string; onUpload: () => void; onOpenCourse: (course: CourseSummary) => void; onDelete: (course: CourseSummary) => void }) {
  const filtered = courses.filter((course) => `${course.title} ${course.description} ${course.filename}`.toLowerCase().includes(filter.toLowerCase()));
  const primary = filtered[0] ?? courses[0];
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  if (!courses.length) return <main className="page dashboard-page"><section className="welcome-row"><div><span className="eyebrow">{today}</span><h1>Good afternoon, Jay.</h1><p>Build a focused learning path from the documents that matter.</p></div></section><EmptyLibrary onUpload={onUpload} /></main>;
  return <main className="page dashboard-page">
    <section className="welcome-row"><div><span className="eyebrow">{today}</span><h1>Good afternoon, Jay.</h1><p>Pick up where you left off or turn a new PDF into a course.</p></div><button className="primary-button" onClick={onUpload}><Plus size={17} /> Create from PDF</button></section>
    {primary && <section className="hero-course"><div className="hero-copy"><span className="resume-pill"><span /> Continue learning</span><h2>{primary.title}</h2><p>{primary.chapter_count} chapters · {primary.lesson_count} lessons</p><div className="next-lesson"><span>Source</span><strong>{primary.filename || "Uploaded PDF"}</strong><em>{primary.page_count} pages</em></div><div className="hero-actions"><button className="light-button" onClick={() => onOpenCourse(primary)}><Play size={14} fill="currentColor" /> Resume course</button><button className="ghost-button" onClick={() => onOpenCourse(primary)}>Course overview <ArrowRight size={15} /></button></div></div><div className="hero-visual"><div className="hero-halo" /><CourseCover course={primary} /><div className="progress-float"><ProgressRing value={primary.progress_percent} size={54} /><div><strong>{primary.completed_lessons} of {primary.lesson_count}</strong><span>lessons complete</span></div></div></div></section>}
    <section className="stats-grid" aria-label="Learning statistics"><StatCard icon={BookOpen} value={String(metrics?.active_courses ?? courses.length)} label="Active courses" note={`${pluralize(metrics?.completed_lessons ?? 0, "lesson")} completed`} tone="violet" /><StatCard icon={Clock} value={formatMinutes(metrics?.minutes_learned ?? 0)} label="Focused time" note="Tracked from lesson activity" tone="cyan" /><StatCard icon={Trophy} value={`${metrics?.quiz_average ?? 0}%`} label="Quiz average" note="Across completed checkpoints" tone="amber" /><StatCard icon={Flame} value={pluralize(metrics?.streak_days ?? 0, "day")} label="Current streak" note="Keep learning daily" tone="rose" /></section>
    <section className="content-grid"><div className="course-section"><div className="section-head"><div><span className="eyebrow">Your library</span><h2>Keep learning</h2></div><button onClick={onUpload}>New course <Plus size={15} /></button></div><div className="course-grid">{filtered.slice(0, 3).map((course, index) => <CourseCard key={course.id} course={course} index={index} onOpen={() => onOpenCourse(course)} onDelete={() => onDelete(course)} />)}{filter && !filtered.length && <div className="empty-search"><Search size={24} /><strong>No matching courses</strong><p>Try a different title or source filename.</p></div>}</div></div><aside className="insights-column"><div className="section-head"><div><span className="eyebrow">This week</span><h2>Learning pulse</h2></div></div><div className="pulse-card"><div className="pulse-total"><strong>{formatMinutes(metrics?.minutes_learned ?? 0)}</strong><span><ArrowRight size={12} /> recorded focus</span></div><div className="bar-chart" aria-label="Study time by day">{[18, 32, 24, 56, 42, 12, Math.max(10, metrics?.minutes_learned ?? 10)].map((height, index) => <div key={index}><span style={{ height: `${Math.min(88, height)}%` }} className={index === 3 ? "peak" : ""} /><small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small></div>)}</div></div><div className="goal-card"><div className="goal-icon"><Target size={19} /></div><div><span className="eyebrow">Weekly goal</span><strong>{Math.min(5, metrics?.streak_days ?? 0)} of 5 focused sessions</strong><div className="goal-dots">{[0, 1, 2, 3, 4].map((item) => <i key={item} className={item < Math.min(5, metrics?.streak_days ?? 0) ? "done" : ""} />)}</div></div><span>{Math.min(100, (metrics?.streak_days ?? 0) * 20)}%</span></div></aside></section>
  </main>;
}

function CoursesView({ courses, filter, onOpenCourse, onUpload, onDelete }: { courses: CourseSummary[]; filter: string; onOpenCourse: (course: CourseSummary) => void; onUpload: () => void; onDelete: (course: CourseSummary) => void }) {
  const [tab, setTab] = useState<"all" | "active" | "complete">("all");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");
  const filtered = useMemo(() => courses.filter((course) => {
    const matchesText = `${course.title} ${course.description} ${course.filename}`.toLowerCase().includes(filter.toLowerCase());
    const matchesTab = tab === "all" || (tab === "complete" ? course.progress_percent === 100 : course.progress_percent < 100);
    return matchesText && matchesTab;
  }).sort((left, right) => sort === "title" ? left.title.localeCompare(right.title) : sort === "progress" ? right.progress_percent - left.progress_percent : new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()), [courses, filter, sort, tab]);
  return <main className="page library-page"><section className="welcome-row compact-welcome"><div><span className="eyebrow">Personal knowledge library</span><h1>My courses</h1><p>Every document you&apos;ve transformed, ready to continue.</p></div><button className="primary-button" onClick={onUpload}><Plus size={17} /> New course</button></section>{!courses.length ? <EmptyLibrary onUpload={onUpload} /> : <><div className="filter-row"><div className="filter-tabs"><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All courses <span>{courses.length}</span></button><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>In progress <span>{courses.filter((item) => item.progress_percent < 100).length}</span></button><button className={tab === "complete" ? "active" : ""} onClick={() => setTab("complete")}>Completed <span>{courses.filter((item) => item.progress_percent === 100).length}</span></button></div><label className="sort-select">Sort<select aria-label="Sort courses" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Last opened</option><option value="title">Title</option><option value="progress">Progress</option></select><ChevronDown size={14} /></label></div><section className="library-grid">{filtered.map((course, index) => <article className="library-card" key={course.id}><button className="library-open" onClick={() => onOpenCourse(course)}><CourseCover course={course} compact index={index} /><div className="library-card-copy"><div><span className="eyebrow">{course.filename || "Source PDF"}</span></div><h2>{course.title}</h2><p>{course.description}</p><div className="library-details"><span><BookOpen size={14} /> {course.lesson_count} lessons</span><span><Clock size={14} /> {formatMinutes(course.estimated_minutes)}</span><span><Gauge size={14} /> {course.difficulty}</span></div><div className="progress-track"><span style={{ width: `${course.progress_percent}%` }} /></div><footer><span>{course.progress_percent}% complete</span><span>Opened {relativeDate(course.updated_at)}</span></footer></div></button><button className="delete-course" onClick={() => onDelete(course)} aria-label={`Delete ${course.title}`}><Trash2 size={15} /></button></article>)}</section>{!filtered.length && <div className="empty-search"><Search size={24} /><strong>No courses in this view</strong><p>Change the filter or create a new course.</p></div>}</>}</main>;
}

function QuizModal({ chapter, onClose, onSaved }: { chapter: Chapter; onClose: () => void; onSaved: () => void }) {
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [answers, setAnswers] = useState<Array<{ question_id: string; answer: number | string }>>([]);
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { coursecraftApi.generateQuiz(chapter.id, 5).then(setQuiz).catch((caught) => setError(messageFrom(caught))); }, [chapter.id]);
  const submit = async () => {
    if (!quiz || selected === null || selected === "") return;
    const item = quiz.questions[index];
    const normalized = String(selected).trim().toLowerCase();
    const correct = item.format === "short_answer"
      ? [String(item.answer), ...(item.accepted_answers ?? [])].some((answer) => normalized.includes(answer.toLowerCase()) || answer.toLowerCase().includes(normalized))
      : selected === item.answer;
    const nextScore = score + (correct ? 1 : 0);
    const nextAnswers = [...answers, { question_id: item.id, answer: selected }];
    setScore(nextScore);
    setAnswers(nextAnswers);
    if (index < quiz.questions.length - 1) { setIndex((value) => value + 1); setSelected(null); return; }
    setSaving(true);
    try { await coursecraftApi.saveQuizAttempt(chapter.id, nextScore, quiz.questions.length, nextAnswers); setComplete(true); onSaved(); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setSaving(false); }
  };
  const current = quiz?.questions[index];
  return <div className="modal-backdrop"><section className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title"><div className="modal-head"><div><span className="eyebrow">{chapter.title} · checkpoint</span><h2 id="quiz-title">Knowledge check</h2></div><button className="icon-button" onClick={onClose} aria-label="Close quiz"><X size={19} /></button></div>{error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}{!quiz && !error && <div className="loading-state"><LoaderCircle className="spin" /><span>Preparing source-aware questions…</span></div>}{quiz && current && !complete && <><div className="quiz-progress"><span style={{ width: `${((index + 1) / quiz.questions.length) * 100}%` }} /></div><div className="quiz-count">Question {index + 1} of {quiz.questions.length} · {current.format.replace("_", " ")}</div><h3>{current.question}</h3>{current.format === "short_answer" ? <textarea className="short-answer" aria-label="Short answer" placeholder="Answer in a phrase or sentence…" value={typeof selected === "string" ? selected : ""} onChange={(event) => setSelected(event.target.value)} /> : <div className="quiz-options">{current.options.map((option, optionIndex) => <button key={`${option}-${optionIndex}`} className={selected === optionIndex ? "selected" : ""} onClick={() => setSelected(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}{selected === optionIndex && <Check size={15} />}</button>)}</div>}<button className="primary-button wide" disabled={selected === null || selected === "" || saving} onClick={submit}>{saving ? <LoaderCircle className="spin" size={15} /> : index === quiz.questions.length - 1 ? "Finish checkpoint" : "Next question"}<ArrowRight size={15} /></button></>}{quiz && complete && <div className="quiz-complete"><div className="score-ring"><strong>{Math.round((score / quiz.questions.length) * 100)}%</strong><span>score</span></div><span className="eyebrow">Checkpoint saved</span><h3>{score >= quiz.questions.length * 0.7 ? "Strong work." : "Keep building."}</h3><p>Your attempt is recorded with the answer review below.</p><div className="answer-review">{quiz.questions.map((question, questionIndex) => <article key={question.id}><strong>{questionIndex + 1}. {question.question}</strong><span>Your answer: {String(answers[questionIndex]?.answer ?? "—")}</span><span>Correct answer: {typeof question.answer === "number" ? question.options[question.answer] : question.answer}</span><p>{question.explanation}</p></article>)}</div><div><button className="ghost-button" onClick={() => { setIndex(0); setSelected(null); setScore(0); setAnswers([]); setComplete(false); }}>Try again</button><button className="primary-button" onClick={onClose}>Continue learning <ArrowRight size={15} /></button></div></div>}</section></div>;
}

function MarkdownContent({ value }: { value: string }) {
  const blocks = value.split(/\n\s*\n/).filter(Boolean);
  return <>{blocks.map((block, index) => {
    const clean = block.trim();
    if (clean.startsWith("### ")) return <h3 key={index}>{clean.slice(4)}</h3>;
    if (clean.startsWith("## ")) return <h2 key={index}>{clean.slice(3)}</h2>;
    if (clean.startsWith("# ")) return <h2 key={index}>{clean.slice(2)}</h2>;
    if (clean.split("\n").every((line) => line.trim().startsWith("- "))) return <ul key={index}>{clean.split("\n").map((line) => <li key={line}>{line.trim().slice(2).replace(/\*\*/g, "")}</li>)}</ul>;
    return <p key={index}>{clean.replace(/\*\*/g, "")}</p>;
  })}</>;
}

function CourseView({ course, onBack, onCourseChange, onMetricsChange }: { course: CourseDetail; onBack: () => void; onCourseChange: (course: CourseDetail) => void; onMetricsChange: () => void }) {
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({ chapter, lesson })));
  const firstIncomplete = lessons.find((item) => !item.lesson.completed) ?? lessons[0];
  const [selectedLessonId, setSelectedLessonId] = useState(firstIncomplete?.lesson.id ?? "");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [quizChapter, setQuizChapter] = useState<Chapter | null>(null);
  const [chat, setChat] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string; citations?: ChatResponse["citations"] }>>([{ role: "assistant", text: "I am grounded in this course and its source PDF. Ask for an explanation, comparison, or practice question." }]);
  const active = lessons.find((item) => item.lesson.id === selectedLessonId) ?? lessons[0];
  const activeIndex = Math.max(0, lessons.findIndex((item) => item.lesson.id === active?.lesson.id));
  const completedCount = lessons.filter((item) => item.lesson.completed).length;
  const progress = lessons.length ? Math.round(completedCount / lessons.length * 100) : 0;
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(() => typeof window === "undefined" || !active?.lesson.id ? "" : window.localStorage.getItem(`coursecraft-note:${active.lesson.id}`) ?? "");

  if (!active) return <main className="page"><EmptyLibrary onUpload={onBack} /></main>;
  const { chapter, lesson } = active;

  const selectByIndex = (next: number) => {
    const target = lessons[next];
    if (target) { setSelectedLessonId(target.lesson.id); setNote(window.localStorage.getItem(`coursecraft-note:${target.lesson.id}`) ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  const selectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setNote(window.localStorage.getItem(`coursecraft-note:${lessonId}`) ?? "");
  };

  const toggleComplete = async () => {
    const next = !lesson.completed;
    await coursecraftApi.updateProgress(lesson.id, next, Math.max(60, lesson.seconds_spent || 0), 0);
    const refreshed = await coursecraftApi.getCourse(course.id);
    onCourseChange(refreshed);
    onMetricsChange();
  };

  const send = async (preset?: string) => {
    const prompt = (preset ?? chat).trim();
    if (!prompt || sending) return;
    setChat("");
    setChatError("");
    const userMessage = { role: "user" as const, text: prompt };
    setMessages((current) => [...current, userMessage]);
    setSending(true);
    try {
      let started = false;
      const response = await coursecraftApi.streamChat(course.id, prompt, messages.slice(-8).map((item) => ({ role: item.role, content: item.text })), lesson.id, (token) => {
        setMessages((current) => {
          if (!started) { started = true; return [...current, { role: "assistant", text: token }]; }
          return current.map((item, itemIndex) => itemIndex === current.length - 1 ? { ...item, text: item.text + token } : item);
        });
      });
      setMessages((current) => started
        ? current.map((item, itemIndex) => itemIndex === current.length - 1 ? { ...item, text: response.answer || item.text, citations: response.citations } : item)
        : [...current, { role: "assistant", text: response.answer, citations: response.citations }]);
    } catch (caught) { setChatError(messageFrom(caught)); }
    finally { setSending(false); }
  };

  return <main className={`learning-page ${assistantOpen ? "assistant-visible" : ""}`}>
    <header className="lesson-header"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Library</button><div className="lesson-breadcrumb"><span>{course.title}</span><ChevronRight size={13} /><strong>{lesson.title}</strong></div><div className="lesson-head-actions"><button onClick={() => setNoteOpen(true)}><NotebookPen size={16} /> Notes</button><button className={assistantOpen ? "active" : ""} onClick={() => setAssistantOpen((value) => !value)}><Bot size={16} /> Companion</button></div></header>
    <aside className="course-outline"><div className="outline-head"><span className="eyebrow">Course outline</span><div><strong>{progress}%</strong><span>{completedCount} of {lessons.length} lessons</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div><div className="chapter-list">{course.chapters.map((item, chapterIndex) => <div className="chapter" key={item.id}><button className="chapter-head"><span><strong>{String(chapterIndex + 1).padStart(2, "0")} · {item.title}</strong><small>{item.lessons.filter((entry) => entry.completed).length} of {item.lessons.length} complete</small></span><ChevronDown size={14} /></button><div className="lesson-list">{item.lessons.map((entry, lessonIndex) => <button className={entry.id === lesson.id ? "active" : ""} onClick={() => selectLesson(entry.id)} key={entry.id}><span className={`lesson-status ${entry.completed ? "complete" : ""}`}>{entry.completed ? <Check size={11} /> : lessonIndex + 1}</span><span><strong>{entry.title}</strong><small>{entry.estimated_minutes} min{entry.id === lesson.id ? " · Now" : ""}</small></span></button>)}</div></div>)}</div><div className="outline-footer"><button disabled={activeIndex === 0} onClick={() => selectByIndex(activeIndex - 1)}><ArrowLeft size={15} /> Previous</button><button disabled={activeIndex === lessons.length - 1} onClick={() => selectByIndex(activeIndex + 1)}>Next <ArrowRight size={15} /></button></div></aside>
    <article className="lesson-content"><div className="lesson-meta"><span className="eyebrow">Chapter {chapter.position + 1} · Lesson {lesson.position + 1}</span><span><Clock size={14} /> {lesson.estimated_minutes} min</span><span><Gauge size={14} /> {course.difficulty}</span></div><h1>{lesson.title}</h1><p className="lesson-lede">{chapter.summary || course.description}</p><div className="lesson-visual"><div><span>01</span><strong>Understand</strong><small>Build the model</small></div><ArrowRight size={20} /><div><span>02</span><strong>Connect</strong><small>Use examples</small></div><ArrowRight size={20} /><div><span>03</span><strong>Practice</strong><small>Check recall</small></div><ArrowRight size={20} /><div><span>04</span><strong>Apply</strong><small>Transfer skill</small></div></div><div className="lesson-markdown"><MarkdownContent value={lesson.content_markdown} /></div>{lesson.takeaways.length > 0 && <div className="key-note"><Sparkles size={18} /><div><span className="eyebrow">Key takeaways</span><ul>{lesson.takeaways.map((item) => <li key={item}>{item}</li>)}</ul></div></div>}{lesson.source_pages.length > 0 && <div className="source-strip"><FileText size={16} /><span>Grounded in source pages</span><strong>{lesson.source_pages.join(", ")}</strong></div>}<div className="lesson-actions"><button className="ghost-button" onClick={() => setQuizChapter(chapter)}><Trophy size={16} /> Take chapter quiz</button><button className={`primary-button ${lesson.completed ? "completed" : ""}`} onClick={() => void toggleComplete()}>{lesson.completed ? <><Check size={16} /> Lesson completed</> : <>Mark complete <ArrowRight size={16} /></>}</button></div></article>
    {assistantOpen && <aside className="assistant-panel"><div className="assistant-head"><div className="assistant-avatar"><Sparkles size={17} /></div><div><strong>Course companion</strong><span><i /> Grounded in this PDF</span></div><button className="icon-button" onClick={() => setAssistantOpen(false)} aria-label="Close companion"><X size={17} /></button></div><div className="assistant-context"><FileText size={16} /><div><span>Current context</span><strong>{lesson.title}</strong></div></div><div className="chat-thread">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}><span>{message.role === "assistant" ? <Sparkles size={13} /> : "JC"}</span><div><p>{message.text}</p>{message.citations?.length ? <div className="chat-citations">{message.citations.map((citation) => <button key={`${citation.page}-${citation.excerpt}`} title={citation.excerpt}>p. {citation.page}</button>)}</div> : null}</div></div>)}{sending && <div className="chat-message assistant"><span><Sparkles size={13} /></span><p className="typing"><i /><i /><i /></p></div>}</div>{chatError && <div className="inline-error"><AlertTriangle size={14} />{chatError}</div>}<div className="prompt-chips"><button onClick={() => void send("Explain this with a real-world analogy")}>Explain with an analogy</button><button onClick={() => void send("Quiz me on this lesson")}>Quiz me</button><button onClick={() => void send("Summarize the key ideas")}>Summarize</button></div><div className="chat-input"><textarea aria-label="Ask the course companion" placeholder="Ask about this lesson…" value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><footer><span><Sparkles size={12} /> Source-aware</span><button disabled={!chat.trim() || sending} onClick={() => void send()} aria-label="Send message"><Send size={15} /></button></footer></div><small className="assistant-disclaimer">Answers can be imperfect. Citations map back to your document.</small></aside>}
    {!assistantOpen && <button className="floating-companion" onClick={() => setAssistantOpen(true)}><Sparkles size={17} /> Ask companion</button>}
    {quizChapter && <QuizModal chapter={quizChapter} onClose={() => setQuizChapter(null)} onSaved={onMetricsChange} />}
    {noteOpen && <div className="modal-backdrop"><section className="utility-modal note-modal" role="dialog" aria-modal="true" aria-labelledby="notes-title"><div className="modal-head"><div><span className="eyebrow">Private lesson note</span><h2 id="notes-title">Notes for {lesson.title}</h2></div><button className="icon-button" onClick={() => setNoteOpen(false)} aria-label="Close notes"><X size={18} /></button></div><textarea aria-label="Lesson notes" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Capture a question, connection, or takeaway…" /><div className="modal-actions"><button className="ghost-button" onClick={() => { setNote(""); window.localStorage.removeItem(`coursecraft-note:${lesson.id}`); }}>Clear</button><button className="primary-button" onClick={() => { window.localStorage.setItem(`coursecraft-note:${lesson.id}`, note); setNoteOpen(false); }}>Save note</button></div></section></div>}
  </main>;
}

function FlashcardModal({ cards, onClose }: { cards: Flashcard[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  return <div className="modal-backdrop"><section className="utility-modal flashcard-modal" role="dialog" aria-modal="true" aria-labelledby="flashcard-title"><div className="modal-head"><div><span className="eyebrow">Smart flashcards · {index + 1} of {cards.length}</span><h2 id="flashcard-title">Recall before reveal</h2></div><button className="icon-button" onClick={onClose} aria-label="Close flashcards"><X size={18} /></button></div><button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)}><span>{flipped ? "Answer" : "Prompt"}</span><strong>{flipped ? card.back : card.front}</strong><small>{flipped && card.source_pages.length ? `Source pages ${card.source_pages.join(", ")}` : "Click to flip"}</small></button><div className="flashcard-actions"><button disabled={index === 0} onClick={() => { setIndex((value) => value - 1); setFlipped(false); }}><ArrowLeft size={15} /> Previous</button><button disabled={index === cards.length - 1} onClick={() => { setIndex((value) => value + 1); setFlipped(false); }}>Next <ArrowRight size={15} /></button></div></section></div>;
}

type StudioArtifact = { kind: "summary"; value: CourseSummaryTool } | { kind: "mind-map"; value: MindMap } | { kind: "diagram"; value: CourseDiagram };

function StudioArtifactModal({ artifact, onClose }: { artifact: StudioArtifact; onClose: () => void }) {
  return <div className="modal-backdrop"><section className="utility-modal artifact-modal" role="dialog" aria-modal="true" aria-labelledby="artifact-title"><div className="modal-head"><div><span className="eyebrow">AI-generated study artifact</span><h2 id="artifact-title">{artifact.value.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close artifact"><X size={18} /></button></div>{artifact.kind === "summary" && <div className="artifact-markdown"><MarkdownContent value={artifact.value.markdown} /><div className="source-strip"><FileText size={15} /> Grounded across pages <strong>{artifact.value.source_pages.join(", ") || "course sources"}</strong></div></div>}{artifact.kind === "mind-map" && <div className="mind-map" aria-label="AI mind map">{artifact.value.nodes.map((node) => <div key={node.id} className={node.kind}><span>{node.kind}</span><strong>{node.label}</strong></div>)}</div>}{artifact.kind === "diagram" && <div className="course-diagram" aria-label="AI learning progression">{artifact.value.steps.map((step, index) => <div key={step.id}><article><span>{String(index + 1).padStart(2, "0")}</span><strong>{step.label}</strong><p>{step.detail}</p></article>{index < artifact.value.steps.length - 1 && <ArrowRight size={18} />}</div>)}</div>}<button className="primary-button wide" onClick={onClose}>Done</button></section></div>;
}

function AiLab({ courses, onOpenCourse }: { courses: CourseSummary[]; onOpenCourse: (course: CourseSummary) => void }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [artifact, setArtifact] = useState<StudioArtifact | null>(null);
  const primary = courses[0];
  const run = async (label: string, action: () => Promise<void>) => { setLoading(label); setError(""); try { await action(); } catch (caught) { setError(messageFrom(caught)); } finally { setLoading(""); } };
  const ask = async (prompt = query) => { if (!primary || !prompt.trim()) return; setQuery(prompt); await run("ask", async () => setAnswer(await coursecraftApi.chat(primary.id, prompt, []))); };
  const speak = () => { if (!primary || !("speechSynthesis" in window)) return setError("Audio narration is not supported in this browser."); window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(`${primary.title}. ${primary.description}. Learning objectives: ${primary.objectives.join(". ")}`); speech.rate = 0.92; window.speechSynthesis.speak(speech); };
  if (!primary) return <main className="page ai-lab-page"><EmptyLibrary onUpload={() => undefined} /></main>;
  const tools = [
    ["flashcards", NotebookPen, "Smart flashcards", "Source-cited recall cards", () => run("flashcards", async () => setCards((await coursecraftApi.flashcards(primary.id)).cards))],
    ["summary", FileText, "PDF summarization", "Executive summary with source pages", () => run("summary", async () => setArtifact({ kind: "summary", value: await coursecraftApi.summarize(primary.id) }))],
    ["mind-map", GitBranch, "AI mind map", "Visual hierarchy of chapters and lessons", () => run("mind-map", async () => setArtifact({ kind: "mind-map", value: await coursecraftApi.mindMap(primary.id) }))],
    ["diagram", Sparkles, "AI diagram", "Learning progression from the source", () => run("diagram", async () => setArtifact({ kind: "diagram", value: await coursecraftApi.diagram(primary.id) }))],
    ["audio", Headphones, "Audio narration", "Browser-native course overview", async () => speak()],
    ["translate", Languages, "Multi-language tutor", "Translate while preserving meaning", () => ask("Explain the key ideas in Hindi, then provide the English terminology in parentheses")],
    ["sprint", Trophy, "Exam sprint", "Generate a focused 30-minute revision plan", () => ask("Build a focused 30-minute exam revision plan from this course")],
    ["export", Download, "Course export", "Download Markdown or structured JSON", () => run("export", () => coursecraftApi.exportCourse(primary.id, "markdown"))],
    ["certificate", Award, "Completion certificate", primary.progress_percent === 100 ? "Download your verified PDF certificate" : `Locked until 100% complete · ${primary.progress_percent}% now`, () => run("certificate", () => coursecraftApi.certificate(primary.id))],
  ] as const;
  return <main className="page ai-lab-page"><section className="ai-hero"><div className="ai-orb"><Sparkles size={30} /></div><span className="eyebrow">AI studio · {primary.title}</span><h1>Your source material,<br />one conversation away.</h1><p>RAG, semantic retrieval, streaming answers, and a persistent vector index keep every tool grounded in your PDF.</p><div className="capability-badges"><span>RAG grounded</span><span>Semantic search</span><span>Vector index</span><span>Markdown</span><span>Dark mode</span></div><div className="ai-query"><Search size={19} /><input aria-label="Ask your library" placeholder="Ask anything about your active course…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask(); }} /><button disabled={!query.trim() || Boolean(loading)} onClick={() => void ask()}>{loading === "ask" ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}</button></div>{error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}{answer && <div className="studio-answer"><Sparkles size={18} /><div><span className="eyebrow">Grounded response</span><MarkdownContent value={answer.answer} /><div className="chat-citations">{answer.citations.map((citation) => <button key={`${citation.page}-${citation.excerpt}`} title={citation.excerpt}>p. {citation.page}</button>)}</div></div></div>}</section><section className="studio-tools"><div className="section-head"><div><span className="eyebrow">Complete bonus suite</span><h2>Study tools</h2></div><button onClick={() => void coursecraftApi.exportCourse(primary.id, "json")}>Export JSON <Download size={14} /></button></div><div className="tool-grid bonus-grid">{tools.map(([id, Icon, title, note, action]) => <article key={id}><span><Icon size={19} /></span><h3>{title}</h3><p>{note}</p><button disabled={Boolean(loading) || (id === "certificate" && primary.progress_percent < 100)} onClick={() => void action()}>{loading === id ? <LoaderCircle className="spin" size={14} /> : null}{id === "certificate" && primary.progress_percent < 100 ? "Complete course" : "Open tool"} <ArrowRight size={14} /></button></article>)}</div></section><section className="recent-context"><div className="section-head"><div><span className="eyebrow">Available context</span><h2>Your connected courses</h2></div></div>{courses.slice(0, 3).map((course, index) => <button key={course.id} onClick={() => onOpenCourse(course)}><CourseCover course={course} compact index={index} /><div><span>{course.filename || "Source PDF"}</span><strong>{course.title}</strong></div><span>{course.lesson_count} lessons</span><ArrowRight size={16} /></button>)}</section>{cards.length > 0 && <FlashcardModal cards={cards} onClose={() => setCards([])} />}{artifact && <StudioArtifactModal artifact={artifact} onClose={() => setArtifact(null)} />}</main>;
}

function HistoryView({ onOpenCourse }: { onOpenCourse: (course: CourseSummary) => void }) {
  const [history, setHistory] = useState<LearningHistory | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { coursecraftApi.history().then(setHistory).catch((caught) => setError(messageFrom(caught))); }, []);
  return <main className="page history-page"><section className="welcome-row compact-welcome"><div><span className="eyebrow">Persistent learning record</span><h1>Learning history</h1><p>Your PDFs, courses, progress, conversations, and quiz attempts in one timeline.</p></div></section>{error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}{!history && !error && <div className="loading-state"><LoaderCircle className="spin" /> Loading history…</div>}{history && <><section className="history-stats"><StatCard icon={FileText} value={String(history.documents.length)} label="PDFs uploaded" note="Processed source documents" tone="violet" /><StatCard icon={BookOpen} value={String(history.courses.length)} label="Courses built" note="Available in your library" tone="cyan" /><StatCard icon={Bot} value={String(history.chat_messages.length)} label="Chat messages" note="Grounded companion history" tone="amber" /><StatCard icon={Trophy} value={String(history.quiz_attempts.length)} label="Quiz attempts" note="Scores are retained" tone="rose" /></section><section className="history-list"><div className="section-head"><div><span className="eyebrow">Recent activity</span><h2>Everything is saved</h2></div></div>{history.quiz_attempts.slice().reverse().slice(0, 5).map((attempt) => <article key={attempt.id}><span><Trophy size={16} /></span><div><strong>Quiz checkpoint · {attempt.percentage}%</strong><small>{relativeDate(attempt.created_at)}</small></div></article>)}{history.chat_messages.slice().reverse().slice(0, 5).map((message) => <article key={message.id}><span><Bot size={16} /></span><div><strong>{message.role === "assistant" ? "Companion response" : "You asked"}</strong><p>{message.content.slice(0, 180)}</p><small>{relativeDate(message.created_at)}</small></div></article>)}{history.courses.map((item) => <button key={item.id} onClick={() => onOpenCourse(item)}><span><BookOpen size={16} /></span><div><strong>{item.title}</strong><small>{item.progress_percent}% complete · {relativeDate(item.updated_at)}</small></div><ArrowRight size={15} /></button>)}</section></>}</main>;
}

function UtilityModal({ panel, onClose }: { panel: Exclude<UtilityPanel, null>; onClose: () => void }) {
  const content = {
    help: ["Help & shortcuts", "Use the left navigation to switch spaces. Search filters your library. In a lesson, Enter sends a companion message and Shift+Enter creates a new line."],
    settings: ["Workspace settings", "CourseCraft uses the dark focus theme, keeps lesson notes on this device, and sends learning records to the local API preview."],
    notifications: ["Notifications", "You are all caught up. New course generation and saved quiz results will appear here."],
    plan: ["Pro workspace", "Your local review build includes PDF generation, source-aware chat, quizzes, flashcards, notes, search, and progress tracking."],
  } as const;
  return <div className="modal-backdrop"><section className="utility-modal" role="dialog" aria-modal="true" aria-labelledby="utility-title"><div className="modal-head"><div><span className="eyebrow">CourseCraft</span><h2 id="utility-title">{content[panel][0]}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p>{content[panel][1]}</p><button className="primary-button wide" onClick={onClose}>Done</button></section></div>;
}

function ConfirmDelete({ course, onCancel, onConfirm, busy }: { course: CourseSummary; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return <div className="modal-backdrop"><section className="utility-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="danger-icon"><Trash2 size={20} /></div><h2 id="delete-title">Delete this course?</h2><p><strong>{course.title}</strong> and its saved progress, chat history, and quiz attempts will be removed from this preview.</p><div className="modal-actions"><button className="ghost-button" onClick={onCancel}>Cancel</button><button className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Delete course</button></div></section></div>;
}

function SearchResults({ query, results, busy, onOpen }: { query: string; results: SearchResult[]; busy: boolean; onOpen: (result: SearchResult) => void }) {
  if (query.trim().length < 2) return null;
  return <section className="search-results" aria-label="Semantic search results"><header><div><span className="eyebrow">Semantic + keyword search</span><strong>{busy ? "Searching your vector index…" : `${results.length} results`}</strong></div>{busy && <LoaderCircle className="spin" size={15} />}</header>{!busy && results.slice(0, 8).map((result) => <button key={`${result.type}-${result.lesson_id || result.chapter_id || result.course_id}`} onClick={() => onOpen(result)}><span className={result.type}>{result.type}</span><div><strong>{result.title}</strong><p>{result.excerpt}</p></div><ArrowRight size={14} /></button>)}{!busy && !results.length && <div className="empty-search"><Search size={20} /><strong>No source matches</strong><p>Try a concept, chapter, lesson, or PDF keyword.</p></div>}</section>;
}

export function CourseCraftApp() {
  const [view, setView] = useState<View>("dashboard");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [utility, setUtility] = useState<UtilityPanel>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const refresh = async () => {
    setError("");
    try {
      const [nextCourses, nextMetrics] = await Promise.all([coursecraftApi.listCourses(), coursecraftApi.dashboard()]);
      setCourses(nextCourses);
      setMetrics(nextMetrics);
    } catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("access_token") || query.get("access_token");
    if (accessToken) {
      const session = { access_token: accessToken, refresh_token: hash.get("refresh_token") || query.get("refresh_token"), token_type: "bearer" };
      window.localStorage.setItem("coursecraft_session", JSON.stringify(session));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    void Promise.all([coursecraftApi.listCourses(), coursecraftApi.dashboard()])
      .then(([nextCourses, nextMetrics]) => { setCourses(nextCourses); setMetrics(nextMetrics); })
      .catch((caught) => setError(messageFrom(caught)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const query = filter.trim();
    if (query.length < 2) return;
    const timer = window.setTimeout(() => { setSearchBusy(true); coursecraftApi.search(query).then((payload) => setSearchResults(payload.results)).catch((caught) => setError(messageFrom(caught))).finally(() => setSearchBusy(false)); }, 250);
    return () => window.clearTimeout(timer);
  }, [filter]);

  const openCourse = async (selected: CourseSummary) => {
    setError("");
    setLoading(true);
    try { setCourse(await coursecraftApi.getCourse(selected.id)); setView("course"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setLoading(false); }
  };

  const navigate = (next: View) => {
    if (next === "course" && !course) {
      if (courses[0]) void openCourse(courses[0]);
      else setToast("Create a course from a PDF first.");
      return;
    }
    setView(next);
  };

  const created = (createdCourse: CourseDetail) => {
    setUploadOpen(false);
    setCourse(createdCourse);
    setView("course");
    setToast("Course generated successfully.");
    void refresh();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await coursecraftApi.deleteCourse(deleteTarget.id); setDeleteTarget(null); setToast("Course deleted."); if (course?.id === deleteTarget.id) setCourse(null); await refresh(); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setDeleting(false); }
  };

  if (loading && !courses.length && !course) return <div className="app-loading"><Logo /><LoaderCircle className="spin" size={28} /><span>Loading your learning workspace…</span></div>;
  if (view === "course" && course) return <><CourseView course={course} onBack={() => { setView("dashboard"); void refresh(); }} onCourseChange={setCourse} onMetricsChange={() => void refresh()} />{toast && <div className="toast"><CircleCheck size={16} />{toast}</div>}</>;

  return <div className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
    <Sidebar view={view} courseCount={courses.length} mobileOpen={mobileOpen} onView={navigate} onClose={() => setMobileOpen(false)} onUtility={setUtility} />
    {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
    <div className="app-main"><Topbar filter={filter} onMenu={() => setMobileOpen(true)} onSearch={setFilter} focusMode={focusMode} onFocus={() => setFocusMode((value) => !value)} onNotifications={() => setUtility("notifications")} /><SearchResults query={filter} results={searchResults} busy={searchBusy} onOpen={(result) => { const selected = courses.find((item) => item.id === result.course_id); if (selected) { setFilter(""); void openCourse(selected); } }} />{error && <div className="global-error"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => void refresh()}><RefreshCw size={14} /> Retry</button></div>}{view === "dashboard" && <Dashboard courses={courses} metrics={metrics} filter={filter} onUpload={() => setUploadOpen(true)} onOpenCourse={(item) => void openCourse(item)} onDelete={setDeleteTarget} />}{view === "courses" && <CoursesView courses={courses} filter={filter} onOpenCourse={(item) => void openCourse(item)} onUpload={() => setUploadOpen(true)} onDelete={setDeleteTarget} />}{view === "ai-lab" && <AiLab courses={courses} onOpenCourse={(item) => void openCourse(item)} />}{view === "history" && <HistoryView onOpenCourse={(item) => void openCourse(item)} />}</div>
    {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onCreated={created} />}
    {utility && <UtilityModal panel={utility} onClose={() => setUtility(null)} />}
    {deleteTarget && <ConfirmDelete course={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} busy={deleting} />}
    {toast && <div className="toast"><CircleCheck size={16} />{toast}</div>}
  </div>;
}
