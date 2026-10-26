import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "npm:docx@9.14.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "https://matchpath.netlify.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max = 5000) => String(v ?? "").trim().slice(0, max);

const ascii = (v: unknown) =>
  clean(v, 20000)
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ");

const safeFile = (v: unknown) => {
  const s = ascii(v).replace(/[^A-Za-z0-9._ -]+/g, "").replace(/\s+/g, " ").trim();
  return (s || "MatchPath Resume").slice(0, 100);
};

function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    border: { bottom: { color: "B8C0CC", space: 1, style: BorderStyle.SINGLE, size: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: "1F2937" })],
  });
}

function bullet(text: unknown) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 50, line: 252 },
    children: [new TextRun({ text: clean(text, 3000), size: 20 })],
  });
}

function plainLine(text: unknown, options: { bold?: boolean; italic?: boolean; size?: number; align?: any } = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: 45, line: 252 },
    children: [new TextRun({
      text: clean(text, 4000),
      bold: options.bold,
      italics: options.italic,
      size: options.size || 20,
    })],
  });
}

async function makeDocx(row: any) {
  const r = row.resume_json || {};
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: clean(r.candidate_name, 200), bold: true, size: 34, color: "111827" })],
  }));

  if (Array.isArray(r.contact_lines) && r.contact_lines.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: r.contact_lines.map((x: any) => clean(x, 500)).join(" | "), size: 18, color: "4B5563" })],
    }));
  }

  if (r.headline) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: clean(r.headline, 500), bold: true, size: 22, color: "374151" })],
    }));
  }

  if (r.professional_summary) {
    children.push(sectionHeading("Professional Summary"));
    children.push(plainLine(r.professional_summary));
  }

  if (Array.isArray(r.core_competencies) && r.core_competencies.length) {
    children.push(sectionHeading("Core Competencies"));
    children.push(plainLine(r.core_competencies.map((x: any) => clean(x, 300)).join(" | ")));
  }

  if (Array.isArray(r.systems_tools) && r.systems_tools.length) {
    children.push(sectionHeading("Systems & Tools"));
    children.push(plainLine(r.systems_tools.map((x: any) => clean(x, 300)).join(" | ")));
  }

  if (Array.isArray(r.experience) && r.experience.length) {
    children.push(sectionHeading("Professional Experience"));
    for (const x of r.experience) {
      const titleEmployer = [clean(x.title, 300), clean(x.employer, 300)].filter(Boolean).join(" - ");
      children.push(new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [new TextRun({ text: titleEmployer, bold: true, size: 21, color: "111827" })],
      }));
      const meta = [clean(x.location, 300), clean(x.dates, 300)].filter(Boolean).join(" | ");
      if (meta) children.push(plainLine(meta, { italic: true, size: 18 }));
      for (const b of (Array.isArray(x.bullets) ? x.bullets : [])) children.push(bullet(b));
    }
  }

  if (Array.isArray(r.education) && r.education.length) {
    children.push(sectionHeading("Education"));
    for (const x of r.education) children.push(plainLine(x));
  }

  if (Array.isArray(r.certifications) && r.certifications.length) {
    children.push(sectionHeading("Certifications"));
    for (const x of r.certifications) children.push(plainLine(x));
  }

  if (Array.isArray(r.additional_sections)) {
    for (const s of r.additional_sections) {
      if (!s?.heading || !Array.isArray(s.items) || !s.items.length) continue;
      children.push(sectionHeading(clean(s.heading, 200)));
      for (const x of s.items) children.push(plainLine(x));
    }
  }

  const doc = new Document({
    creator: "MatchPath",
    title: clean(row.category_name, 200) + " - General Resume",
    description: "MatchPath generated general resume",
    sections: [{
      properties: {
        page: {
          margin: { top: 620, right: 720, bottom: 620, left: 720 },
        },
      },
      children,
    }],
  });

  const bytes = await Packer.toBuffer(doc);
  return new Uint8Array(bytes);
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) current = word;
      else {
        let chunk = "";
        for (const ch of word) {
          const next = chunk + ch;
          if (font.widthOfTextAtSize(next, size) <= maxWidth) chunk = next;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function makePdf(row: any) {
  const r = row.resume_json || {};
  const pdf = await PDFDocument.create();
  pdf.setCreator("MatchPath");
  pdf.setTitle(clean(row.category_name, 200) + " - General Resume");
  pdf.setSubject("MatchPath generated general resume");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 48;
  const marginTop = 46;
  const marginBottom = 46;
  const contentWidth = pageWidth - marginX * 2;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  const ensure = (height: number) => {
    if (y - height >= marginBottom) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
  };

  const drawLines = (text: unknown, opts: {
    size?: number; font?: any; indent?: number; after?: number; lineGap?: number; align?: "left" | "center";
  } = {}) => {
    const size = opts.size || 9.5;
    const f = opts.font || regular;
    const indent = opts.indent || 0;
    const maxWidth = contentWidth - indent;
    const lines = wrapText(ascii(text), f, size, maxWidth);
    const lineHeight = size + (opts.lineGap ?? 3.2);
    ensure(lines.length * lineHeight + (opts.after ?? 3));
    for (const line of lines) {
      let x = marginX + indent;
      if (opts.align === "center") {
        x = Math.max(marginX, (pageWidth - f.widthOfTextAtSize(line, size)) / 2);
      }
      page.drawText(line, { x, y, size, font: f, color: rgb(0.08, 0.10, 0.14) });
      y -= lineHeight;
    }
    y -= opts.after ?? 3;
  };

  const heading = (text: string) => {
    ensure(28);
    y -= 5;
    page.drawText(ascii(text).toUpperCase(), { x: marginX, y, size: 10.5, font: bold, color: rgb(0.12, 0.16, 0.22) });
    y -= 5;
    page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.6, color: rgb(0.72, 0.76, 0.81) });
    y -= 12;
  };

  const bulletLine = (text: unknown) => {
    const size = 9.3;
    const lines = wrapText(ascii(text), regular, size, contentWidth - 18);
    const lineHeight = 12.2;
    ensure(lines.length * lineHeight + 2);
    if (lines.length) {
      page.drawText("-", { x: marginX + 2, y, size, font: regular });
      page.drawText(lines[0], { x: marginX + 15, y, size, font: regular });
      y -= lineHeight;
      for (let i = 1; i < lines.length; i++) {
        page.drawText(lines[i], { x: marginX + 15, y, size, font: regular });
        y -= lineHeight;
      }
    }
    y -= 2;
  };

  const name = ascii(r.candidate_name || "Candidate");
  page.drawText(name, {
    x: Math.max(marginX, (pageWidth - bold.widthOfTextAtSize(name, 17)) / 2),
    y, size: 17, font: bold, color: rgb(0.05, 0.07, 0.10),
  });
  y -= 21;

  if (Array.isArray(r.contact_lines) && r.contact_lines.length) {
    drawLines(r.contact_lines.map((x: any) => ascii(x)).join(" | "), { size: 8.5, align: "center", after: 4 });
  }
  if (r.headline) drawLines(r.headline, { size: 10.5, font: bold, align: "center", after: 8 });

  if (r.professional_summary) {
    heading("Professional Summary");
    drawLines(r.professional_summary, { size: 9.4, after: 5 });
  }

  if (Array.isArray(r.core_competencies) && r.core_competencies.length) {
    heading("Core Competencies");
    drawLines(r.core_competencies.map((x: any) => ascii(x)).join(" | "), { size: 9.1, after: 5 });
  }

  if (Array.isArray(r.systems_tools) && r.systems_tools.length) {
    heading("Systems & Tools");
    drawLines(r.systems_tools.map((x: any) => ascii(x)).join(" | "), { size: 9.1, after: 5 });
  }

  if (Array.isArray(r.experience) && r.experience.length) {
    heading("Professional Experience");
    for (const x of r.experience) {
      ensure(48);
      drawLines([ascii(x.title), ascii(x.employer)].filter(Boolean).join(" - "), { size: 10, font: bold, after: 0 });
      const meta = [ascii(x.location), ascii(x.dates)].filter(Boolean).join(" | ");
      if (meta) drawLines(meta, { size: 8.6, font: italic, after: 4 });
      for (const b of (Array.isArray(x.bullets) ? x.bullets : [])) bulletLine(b);
      y -= 3;
    }
  }

  if (Array.isArray(r.education) && r.education.length) {
    heading("Education");
    for (const x of r.education) drawLines(x, { size: 9.3, after: 2 });
  }

  if (Array.isArray(r.certifications) && r.certifications.length) {
    heading("Certifications");
    for (const x of r.certifications) drawLines(x, { size: 9.3, after: 2 });
  }

  if (Array.isArray(r.additional_sections)) {
    for (const s of r.additional_sections) {
      if (!s?.heading || !Array.isArray(s.items) || !s.items.length) continue;
      heading(ascii(s.heading));
      for (const x of s.items) drawLines(x, { size: 9.3, after: 2 });
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = "Page " + (i + 1) + " of " + pages.length;
    p.drawText(label, {
      x: pageWidth - marginX - regular.widthOfTextAtSize(label, 7.5),
      y: 24,
      size: 7.5,
      font: regular,
      color: rgb(0.45, 0.48, 0.52),
    });
  });

  return await pdf.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await admin.auth.getUser(auth.slice(7));
    if (userError || !user) return jsonResponse({ error: "Invalid session" }, 401);

    const input = await req.json().catch(() => ({}));
    const resumeId = clean(input.resume_id, 80);
    const format = clean(input.format, 20).toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(resumeId)) return jsonResponse({ error: "Valid resume required" }, 400);
    if (!["docx", "pdf"].includes(format)) return jsonResponse({ error: "Format must be docx or pdf" }, 400);

    const { data: row, error: rowError } = await admin.from("general_resume_versions")
      .select("*").eq("id", resumeId).single();
    if (rowError || !row) return jsonResponse({ error: "General resume not found" }, 404);

    const [{ data: actor }, { data: customer }] = await Promise.all([
      admin.from("accounts").select("role").eq("id", user.id).single(),
      admin.from("accounts").select("full_name").eq("id", row.customer_id).single(),
    ]);

    let authorized = actor?.role === "admin";
    if (!authorized && actor?.role === "staff") {
      const { data: assignment } = await admin.from("staff_assignments")
        .select("customer_id").eq("staff_id", user.id).eq("customer_id", row.customer_id).maybeSingle();
      authorized = !!assignment;
    }
    if (!authorized && actor?.role === "customer") authorized = user.id === row.customer_id;
    if (!authorized) return jsonResponse({ error: "Not authorized for this resume" }, 403);

    const candidate = clean(row.resume_json?.candidate_name || customer?.full_name || "Candidate", 120);
    const base = safeFile(candidate + " - " + row.category_name + " - v" + row.version);
    const bytes = format === "docx" ? await makeDocx(row) : await makePdf(row);
    const type = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    await admin.from("audit_events").insert({
      actor_id: user.id,
      customer_id: row.customer_id,
      action: "general_resume_exported",
      details: { resume_id: row.id, category_key: row.category_key, version: row.version, format },
    });

    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": type,
        "Content-Disposition": 'attachment; filename="' + base + "." + format + '"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unexpected resume export error" }, 500);
  }
});
