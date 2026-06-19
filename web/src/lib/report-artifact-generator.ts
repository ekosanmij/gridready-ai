import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import type { ReportVersionSnapshot } from "@/lib/report-artifacts";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const navy = rgb(0.08, 0.17, 0.29);
const blue = rgb(0.05, 0.38, 0.55);
const green = rgb(0.08, 0.51, 0.32);
const red = rgb(0.72, 0.16, 0.2);
const gray = rgb(0.36, 0.42, 0.5);
const lightGray = rgb(0.91, 0.93, 0.95);

function ascii(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "*")
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function xml(value: unknown) {
  return ascii(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateLabel(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ascii(value)
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function dateTimeLabel(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return ascii(value);
  return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date)} UTC`;
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const paragraphs = ascii(text).split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
      } else if (line) {
        lines.push(line);
        line = word;
      } else {
        lines.push(word);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

class ReportWriter {
  readonly document: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  page: PDFPage;
  y: number;

  constructor(document: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.document = document;
    this.regular = regular;
    this.bold = bold;
    this.page = document.addPage([pageWidth, pageHeight]);
    this.y = pageHeight - margin;
  }

  addPage(title?: string) {
    this.page = this.document.addPage([pageWidth, pageHeight]);
    this.y = pageHeight - margin;
    if (title) this.heading(title, 20);
  }

  ensure(height: number) {
    if (this.y - height < 58) this.addPage();
  }

  heading(text: string, size = 17) {
    this.ensure(size + 24);
    this.page.drawText(ascii(text), { x: margin, y: this.y - size, size, font: this.bold, color: navy });
    this.y -= size + 12;
  }

  subheading(text: string) {
    this.ensure(28);
    this.page.drawText(ascii(text), { x: margin, y: this.y - 11, size: 11, font: this.bold, color: blue });
    this.y -= 23;
  }

  paragraph(text: unknown, options: { color?: ReturnType<typeof rgb>; size?: number; spacing?: number } = {}) {
    const size = options.size ?? 9.5;
    const lineHeight = size * 1.48;
    const lines = wrapText(ascii(text), this.regular, size, pageWidth - margin * 2);
    for (const line of lines) {
      this.ensure(lineHeight + 2);
      if (line) this.page.drawText(line, { x: margin, y: this.y - size, size, font: this.regular, color: options.color ?? navy });
      this.y -= lineHeight;
    }
    this.y -= options.spacing ?? 7;
  }

  keyValue(label: string, value: unknown) {
    this.ensure(20);
    this.page.drawText(ascii(label), { x: margin, y: this.y - 9, size: 8.5, font: this.bold, color: gray });
    const valueLines = wrapText(ascii(value), this.regular, 9.5, pageWidth - margin * 2 - 145);
    valueLines.forEach((line, index) => {
      this.page.drawText(line, { x: margin + 145, y: this.y - 9 - index * 13, size: 9.5, font: this.regular, color: navy });
    });
    this.y -= Math.max(20, valueLines.length * 13 + 5);
  }

  rule() {
    this.page.drawLine({ start: { x: margin, y: this.y }, end: { x: pageWidth - margin, y: this.y }, thickness: 0.7, color: lightGray });
    this.y -= 12;
  }
}

export async function generateSiteMapPng(snapshot: ReportVersionSnapshot) {
  const width = 1200;
  const height = 760;
  const plot = { x: 70, y: 105, width: 820, height: 570 };
  const siteLat = numeric(snapshot.site?.latitude) ?? 0;
  const siteLon = numeric(snapshot.site?.longitude) ?? 0;
  const cosLatitude = Math.max(0.2, Math.cos(siteLat * Math.PI / 180));
  const points = snapshot.grid_assets.map((asset) => {
    const latitude = numeric(asset.latitude) ?? siteLat;
    const longitude = numeric(asset.longitude) ?? siteLon;
    return {
      asset,
      eastMiles: (longitude - siteLon) * 69.172 * cosLatitude,
      northMiles: (latitude - siteLat) * 69,
    };
  });
  const furthest = Math.max(0, ...points.flatMap((point) => [Math.abs(point.eastMiles), Math.abs(point.northMiles)]));
  const radius = [5, 10, 25, 50, 100].find((candidate) => candidate >= Math.max(5, furthest * 1.25)) ?? 100;
  const scaleX = plot.width / (radius * 2);
  const scaleY = plot.height / (radius * 2);
  const centerX = plot.x + plot.width / 2;
  const centerY = plot.y + plot.height / 2;
  const rings = [0.25, 0.5, 1].map((portion) => {
    const ringRadius = Math.min(plot.width, plot.height) / 2 * portion;
    return `<circle cx="${centerX}" cy="${centerY}" r="${ringRadius}" fill="none" stroke="#9aafbb" stroke-width="2" stroke-dasharray="8 8"/><text x="${centerX + 8}" y="${centerY - ringRadius + 18}" font-size="17" fill="#52616b">${Math.round(radius * portion)} mi</text>`;
  }).join("");
  const grid = Array.from({ length: 9 }, (_, index) => {
    const x = plot.x + plot.width * index / 8;
    const y = plot.y + plot.height * index / 8;
    return `<line x1="${x}" y1="${plot.y}" x2="${x}" y2="${plot.y + plot.height}" stroke="#dbe4e8"/><line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.width}" y2="${y}" stroke="#dbe4e8"/>`;
  }).join("");
  const assetMarkers = points.slice(0, 30).map(({ asset, eastMiles, northMiles }, index) => {
    const x = centerX + eastMiles * scaleX;
    const y = centerY - northMiles * scaleY;
    const candidate = Boolean(asset.is_candidate_poi);
    const label = index < 10 ? `<text x="${x + 12}" y="${y - 10}" font-size="15" font-weight="600" fill="#142b49">${xml(asset.asset_name)}</text>` : "";
    return `<circle cx="${x}" cy="${y}" r="8" fill="${candidate ? "#d47f17" : "#148277"}" stroke="#ffffff" stroke-width="3"/>${label}`;
  }).join("");
  const sources = [...new Set(snapshot.grid_assets.map((asset) => ascii(asset.source, "Analyst-recorded source")))].slice(0, 5);
  const sourceLines = sources.length ? sources : ["No external grid-asset source recorded"];
  const scaleMiles = Math.max(1, Math.round(radius / 4));
  const scalePixels = scaleMiles * scaleX;
  const captured = dateTimeLabel(snapshot.captured_at);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="1200" height="760" fill="#f7faf9"/>
    <text x="70" y="48" font-family="Arial" font-size="28" font-weight="700" fill="#142b49">Site and grid context</text>
    <text x="70" y="77" font-family="Arial" font-size="17" fill="#52616b">${xml(snapshot.site?.site_name)} | ${siteLat.toFixed(5)}, ${siteLon.toFixed(5)} | Captured ${xml(captured)}</text>
    <rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="4" fill="#edf4f2" stroke="#8fa7b2" stroke-width="2"/>
    ${grid}${rings}
    <line x1="${centerX}" y1="${plot.y}" x2="${centerX}" y2="${plot.y + plot.height}" stroke="#b8c8cf" stroke-width="2"/>
    <line x1="${plot.x}" y1="${centerY}" x2="${plot.x + plot.width}" y2="${centerY}" stroke="#b8c8cf" stroke-width="2"/>
    ${assetMarkers}
    <path d="M ${centerX} ${centerY - 17} C ${centerX - 18} ${centerY - 17}, ${centerX - 21} ${centerY + 6}, ${centerX} ${centerY + 27} C ${centerX + 21} ${centerY + 6}, ${centerX + 18} ${centerY - 17}, ${centerX} ${centerY - 17} Z" fill="#b82a35" stroke="#ffffff" stroke-width="3"/>
    <circle cx="${centerX}" cy="${centerY - 5}" r="6" fill="#ffffff"/>
    <text x="${plot.x + 15}" y="${plot.y + 28}" font-family="Arial" font-size="17" font-weight="700" fill="#142b49">N</text>
    <path d="M ${plot.x + 22} ${plot.y + 62} L ${plot.x + 22} ${plot.y + 35} L ${plot.x + 14} ${plot.y + 48} M ${plot.x + 22} ${plot.y + 35} L ${plot.x + 30} ${plot.y + 48}" stroke="#142b49" stroke-width="3" fill="none"/>
    <line x1="${plot.x + 25}" y1="${plot.y + plot.height - 24}" x2="${plot.x + 25 + scalePixels}" y2="${plot.y + plot.height - 24}" stroke="#142b49" stroke-width="5"/>
    <line x1="${plot.x + 25}" y1="${plot.y + plot.height - 31}" x2="${plot.x + 25}" y2="${plot.y + plot.height - 17}" stroke="#142b49" stroke-width="3"/>
    <line x1="${plot.x + 25 + scalePixels}" y1="${plot.y + plot.height - 31}" x2="${plot.x + 25 + scalePixels}" y2="${plot.y + plot.height - 17}" stroke="#142b49" stroke-width="3"/>
    <text x="${plot.x + 25}" y="${plot.y + plot.height - 38}" font-family="Arial" font-size="15" fill="#142b49">${scaleMiles} miles</text>
    <rect x="925" y="105" width="225" height="570" rx="4" fill="#ffffff" stroke="#c8d4da"/>
    <text x="950" y="145" font-family="Arial" font-size="20" font-weight="700" fill="#142b49">Legend</text>
    <circle cx="960" cy="181" r="8" fill="#b82a35"/><text x="980" y="187" font-family="Arial" font-size="16" fill="#142b49">Assessment site</text>
    <circle cx="960" cy="216" r="8" fill="#148277"/><text x="980" y="222" font-family="Arial" font-size="16" fill="#142b49">Saved grid asset</text>
    <circle cx="960" cy="251" r="8" fill="#d47f17"/><text x="980" y="257" font-family="Arial" font-size="16" fill="#142b49">Candidate POI</text>
    <text x="950" y="308" font-family="Arial" font-size="18" font-weight="700" fill="#142b49">Recorded context</text>
    <text x="950" y="340" font-family="Arial" font-size="15" fill="#52616b">Utility: ${xml(snapshot.assessment.known_utility)}</text>
    <text x="950" y="368" font-family="Arial" font-size="15" fill="#52616b">TSP: ${xml(snapshot.assessment.known_tsp)}</text>
    <text x="950" y="396" font-family="Arial" font-size="15" fill="#52616b">Market: ${xml(snapshot.assessment.market_region)}</text>
    <text x="950" y="446" font-family="Arial" font-size="18" font-weight="700" fill="#142b49">Sources</text>
    ${sourceLines.map((source, index) => `<text x="950" y="${477 + index * 25}" font-family="Arial" font-size="14" fill="#52616b">${xml(source).slice(0, 28)}</text>`).join("")}
    <text x="950" y="622" font-family="Arial" font-size="13" fill="#52616b">Coordinate-based screening map.</text>
    <text x="950" y="644" font-family="Arial" font-size="13" fill="#52616b">Not a survey or utility study.</text>
    <text x="70" y="722" font-family="Arial" font-size="14" fill="#52616b">GridReady AI | Report version ${snapshot.report_version.version_number} | Exact stored artifact used in the issued report</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function generateReportPdf(snapshot: ReportVersionSnapshot, mapPng: Uint8Array) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const writer = new ReportWriter(document, regular, bold);
  const title = ascii(snapshot.assessment.assessment_name, "GridReady assessment");
  const capturedAt = new Date(snapshot.captured_at);
  const stableDate = Number.isNaN(capturedAt.getTime()) ? new Date(0) : capturedAt;
  document.setTitle(`${title} - report version ${snapshot.report_version.version_number}`);
  document.setAuthor("GridReady AI");
  document.setSubject("Site power feasibility and interconnection readiness assessment");
  document.setCreationDate(stableDate);
  document.setModificationDate(stableDate);

  writer.page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.97, 0.98, 0.98) });
  writer.page.drawRectangle({ x: 0, y: pageHeight - 205, width: pageWidth, height: 205, color: navy });
  writer.page.drawText("GRIDREADY AI", { x: margin, y: pageHeight - 65, size: 13, font: bold, color: rgb(1, 1, 1) });
  const titleLines = wrapText(title, bold, 28, pageWidth - margin * 2);
  titleLines.slice(0, 3).forEach((line, index) => writer.page.drawText(line, { x: margin, y: pageHeight - 112 - index * 34, size: 28, font: bold, color: rgb(1, 1, 1) }));
  writer.page.drawText("SITE POWER FEASIBILITY AND INTERCONNECTION READINESS", { x: margin, y: pageHeight - 235, size: 10, font: bold, color: blue });
  writer.y = pageHeight - 280;
  writer.keyValue("Customer", snapshot.organisation.name);
  writer.keyValue("Project", snapshot.project.name);
  writer.keyValue("Site", snapshot.site?.site_name);
  writer.keyValue("Market", snapshot.assessment.market_region);
  writer.keyValue("Issued version", snapshot.report_version.version_number);
  writer.keyValue("Finalized", dateLabel(snapshot.report_version.finalized_at));
  writer.keyValue("Reviewer", snapshot.expert_review?.reviewer_name);
  writer.y -= 22;
  writer.paragraph("Confidential assessment prepared for the named customer organisation. Distribution is controlled through GridReady AI secure delivery.", { color: gray, size: 9 });

  writer.addPage("Contents");
  writer.paragraph("Report overview\nSite and grid context map\nScorecard and verdict\nMaterial findings and evidence gaps\nAuthored assessment sections\nEvidence appendix\nReview and limitations");

  writer.addPage("Report overview");
  writer.keyValue("Assessment", title);
  writer.keyValue("Target load", snapshot.assessment.target_load_mw ? `${snapshot.assessment.target_load_mw} MW` : null);
  writer.keyValue("Desired energization", dateLabel(snapshot.assessment.desired_energization_date));
  writer.keyValue("Known utility", snapshot.assessment.known_utility);
  writer.keyValue("Known TSP", snapshot.assessment.known_tsp);
  writer.keyValue("Project stage", ascii(snapshot.assessment.project_stage).replaceAll("_", " "));
  writer.rule();
  writer.subheading("Verdict");
  writer.paragraph(snapshot.verdict?.summary ?? snapshot.verdict?.verdict ?? "No verdict narrative recorded.");
  if (snapshot.verdict?.conditions) {
    writer.subheading("Conditions");
    writer.paragraph(snapshot.verdict.conditions);
  }

  writer.addPage("Site and grid context");
  const embeddedMap = await document.embedPng(Uint8Array.from(mapPng));
  const mapDimensions = embeddedMap.scaleToFit(pageWidth - margin * 2, 345);
  writer.page.drawImage(embeddedMap, { x: margin, y: writer.y - mapDimensions.height, width: mapDimensions.width, height: mapDimensions.height });
  writer.y -= mapDimensions.height + 14;
  writer.paragraph("This stored map is the exact map artifact associated with this report version. It is a coordinate-based screening view and does not replace a survey, utility study, or engineering model.", { color: gray, size: 8.5 });

  writer.addPage("Scorecard and verdict");
  const overallScore = snapshot.score_calculation?.overall_score ?? snapshot.scores.find((score) => score.module_key === "overall_readiness")?.score;
  writer.keyValue("Overall readiness", overallScore === null || overallScore === undefined ? null : `${overallScore}/100`);
  writer.keyValue("Readiness band", ascii(snapshot.score_calculation?.readiness_band).replaceAll("_", " "));
  writer.keyValue("Overall confidence", snapshot.score_calculation?.overall_confidence ?? snapshot.verdict?.confidence_level);
  writer.keyValue("Canonical verdict", ascii(snapshot.verdict?.verdict).replaceAll("_", " "));
  writer.rule();
  for (const score of snapshot.scores.filter((item) => item.module_key !== "overall_readiness")) {
    writer.ensure(25);
    writer.keyValue(ascii(score.module_key).replaceAll("_", " "), `${ascii(score.score)} / 100 | ${ascii(score.confidence_level)} confidence`);
  }

  writer.addPage("Material findings and evidence gaps");
  if (!snapshot.findings.length) writer.paragraph("No unresolved findings were included in this version.");
  snapshot.findings.forEach((finding, index) => {
    writer.subheading(`${index + 1}. ${ascii(finding.title)}`);
    writer.paragraph(`${ascii(finding.risk_level)} risk | ${ascii(finding.confidence_level)} confidence` , { color: finding.risk_level === "critical" ? red : gray, size: 8.5 });
    writer.paragraph(finding.statement);
    if (finding.recommendation) writer.paragraph(`Recommendation: ${ascii(finding.recommendation)}`, { color: green, size: 9 });
  });
  if (snapshot.evidence_gaps.length) {
    writer.heading("Open evidence gaps", 14);
    snapshot.evidence_gaps.forEach((gap) => writer.paragraph(`${ascii(gap.title)}: ${ascii(gap.impact)}`));
  }

  for (const section of snapshot.sections) {
    writer.addPage(ascii(section.title, "Assessment section"));
    writer.paragraph(section.content);
  }

  writer.addPage("Evidence appendix");
  if (!snapshot.evidence_sources.length) writer.paragraph("No evidence sources were recorded.");
  snapshot.evidence_sources.forEach((source, index) => {
    writer.subheading(`${index + 1}. ${ascii(source.title)}`);
    writer.keyValue("Type", ascii(source.source_type).replaceAll("_", " "));
    writer.keyValue("Publisher", source.publisher);
    writer.keyValue("Confidence", source.confidence_level);
    writer.keyValue("Published", dateLabel(source.published_at));
    writer.keyValue("Accessed", dateLabel(source.accessed_at));
    if (source.url) writer.paragraph(source.url, { color: blue, size: 8 });
    if (source.limitation_notes) writer.paragraph(`Limitation: ${ascii(source.limitation_notes)}`, { color: gray, size: 8.5 });
    writer.rule();
  });

  writer.addPage("Review and limitations");
  writer.keyValue("Reviewer", snapshot.expert_review?.reviewer_name);
  writer.keyValue("Approved", dateLabel(snapshot.expert_review?.approved_at));
  snapshot.expert_review_checklist.forEach((item) => writer.keyValue(ascii(item.label), ascii(item.status).replaceAll("_", " ")));
  writer.rule();
  writer.subheading("Important limitations");
  writer.paragraph(snapshot.verdict?.limitations_note ?? "This is an early-stage power feasibility and interconnection-readiness assessment, not an official utility, TSP, ISO/RTO, legal, survey, or engineering study. It does not guarantee power availability, interconnection approval, energization timing, upgrade cost, or commercial terms.");

  const pages = document.getPages();
  pages.forEach((page, index) => {
    if (index > 0) page.drawText("GRIDREADY AI | CONFIDENTIAL", { x: margin, y: pageHeight - 28, size: 7.5, font: bold, color: gray });
    page.drawText(`Report v${snapshot.report_version.version_number} | Page ${index + 1} of ${pages.length}`, { x: margin, y: 25, size: 7.5, font: regular, color: gray });
    page.drawText(ascii(snapshot.assessment.assessment_name), { x: pageWidth / 2 - 65, y: 25, size: 7.5, font: regular, color: gray });
  });

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}
