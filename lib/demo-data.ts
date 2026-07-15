export type Course = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  progress: number;
  lessons: number;
  duration: string;
  level: string;
  accent: string;
  updated: string;
  score?: number;
};

export type Lesson = {
  id: number;
  title: string;
  duration: string;
  complete: boolean;
  active?: boolean;
};

export const courses: Course[] = [
  {
    id: "transformers",
    title: "Building Reliable Generative AI Systems",
    eyebrow: "Artificial intelligence",
    description: "Architecture, evaluation, RAG, and the production patterns behind dependable AI products.",
    progress: 68,
    lessons: 24,
    duration: "6h 40m",
    level: "Advanced",
    accent: "violet",
    updated: "12 min ago",
    score: 91,
  },
  {
    id: "behavioral-economics",
    title: "Thinking in Bets",
    eyebrow: "Behavioral economics",
    description: "Make sharper decisions when the information is incomplete and outcomes are uncertain.",
    progress: 42,
    lessons: 18,
    duration: "4h 15m",
    level: "Intermediate",
    accent: "amber",
    updated: "Yesterday",
    score: 84,
  },
  {
    id: "systems-design",
    title: "Designing Data-Intensive Applications",
    eyebrow: "Software architecture",
    description: "A practical mental model for storage, distributed systems, and resilient data platforms.",
    progress: 23,
    lessons: 31,
    duration: "9h 10m",
    level: "Advanced",
    accent: "cyan",
    updated: "3 days ago",
  },
  {
    id: "product-craft",
    title: "The Product Strategy Field Guide",
    eyebrow: "Product management",
    description: "Turn customer evidence into focused bets, useful roadmaps, and measurable outcomes.",
    progress: 8,
    lessons: 16,
    duration: "3h 30m",
    level: "Foundational",
    accent: "rose",
    updated: "1 week ago",
  },
];

export const chapterGroups: { title: string; meta: string; lessons: Lesson[] }[] = [
  {
    title: "01 · Foundations",
    meta: "4 of 4 complete",
    lessons: [
      { id: 1, title: "What makes a system generative?", duration: "8 min", complete: true },
      { id: 2, title: "The model is not the product", duration: "11 min", complete: true },
      { id: 3, title: "Tokens, context, and constraints", duration: "14 min", complete: true },
      { id: 4, title: "Checkpoint · Foundations", duration: "6 min", complete: true },
    ],
  },
  {
    title: "02 · Retrieval systems",
    meta: "3 of 5 complete",
    lessons: [
      { id: 5, title: "Why retrieval changes the game", duration: "12 min", complete: true },
      { id: 6, title: "Chunking for meaning", duration: "16 min", complete: true },
      { id: 7, title: "Embeddings and vector space", duration: "18 min", complete: true },
      { id: 8, title: "Building the retrieval loop", duration: "17 min", complete: false, active: true },
      { id: 9, title: "Checkpoint · Retrieval", duration: "8 min", complete: false },
    ],
  },
  {
    title: "03 · Evaluation & safety",
    meta: "0 of 4 complete",
    lessons: [
      { id: 10, title: "What good looks like", duration: "13 min", complete: false },
      { id: 11, title: "Designing eval datasets", duration: "19 min", complete: false },
      { id: 12, title: "Guardrails and failure modes", duration: "15 min", complete: false },
      { id: 13, title: "Checkpoint · Evaluation", duration: "8 min", complete: false },
    ],
  },
];

export const quiz = [
  {
    question: "What is the primary role of retrieval in a RAG system?",
    options: [
      "To retrain the language model on every request",
      "To provide relevant source context before generation",
      "To compress the model into fewer parameters",
      "To replace prompts with database queries",
    ],
    answer: 1,
    explanation: "Retrieval supplies grounded, relevant context that the language model uses to form its answer.",
  },
  {
    question: "Which chunking strategy best preserves meaning?",
    options: [
      "Split at an arbitrary fixed character count only",
      "Put the complete PDF into a single chunk",
      "Use semantic boundaries with controlled overlap",
      "Remove headings and document structure first",
    ],
    answer: 2,
    explanation: "Semantic boundaries preserve coherent ideas; overlap keeps context from being lost at the edges.",
  },
  {
    question: "A grounded answer should always include what?",
    options: ["A longer prompt", "A confidence of 100%", "A citation to supporting context", "A generated image"],
    answer: 2,
    explanation: "Citations make the evidence inspectable and help users distinguish sourced facts from synthesis.",
  },
];
