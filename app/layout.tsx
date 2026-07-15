import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourseCraft - Turn any document into mastery",
  description: "An AI learning workspace that transforms PDFs into structured courses, focused lessons, adaptive quizzes, and grounded conversations.",
  applicationName: "CourseCraft",
  keywords: ["AI learning", "PDF course generator", "RAG", "education"],
  openGraph: {
    title: "CourseCraft - Turn any document into mastery",
    description: "From dense PDF to a course you will actually finish.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CourseCraft",
    description: "From dense PDF to a course you will actually finish.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
