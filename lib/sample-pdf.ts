function pageStream(title: string, lines: string[]): string {
  const text = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    `(${title}) Tj`,
    "/F1 11 Tf",
    ...lines.flatMap((line) => ["0 -28 Td", `(${line}) Tj`]),
    "ET",
  ].join("\n");

  return `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
}

export function createSamplePdf(): File {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>",
    pageStream("Grounded Retrieval Systems", [
      "Retrieval starts by dividing source documents into useful chunks.",
      "Each answer should be supported by evidence from a source page.",
      "Chunk overlap keeps ideas intact across boundaries.",
    ]),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>",
    pageStream("Ranking and Citations", [
      "A query is compared with indexed chunks to find relevant evidence.",
      "Ranking selects the strongest passages before generation begins.",
      "Citations let learners inspect the page behind each explanation.",
    ]),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>",
    pageStream("Evaluation and Safety", [
      "A grounded answer must not invent claims absent from the document.",
      "Useful evaluations test retrieval, faithfulness, and citation quality.",
      "When evidence is missing, the assistant should say so clearly.",
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new File([pdf], "coursecraft-retrieval-guide.pdf", { type: "application/pdf" });
}
