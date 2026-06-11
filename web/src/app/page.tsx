"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  Landmark,
  Layers,
  LineChart,
  Mail,
  MapPin,
  RadioTower,
  Search,
  Server,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type DemoFormState = {
  name: string;
  email: string;
  company: string;
  role: string;
  load: string;
  message: string;
};

const initialDemoForm: DemoFormState = {
  name: "",
  email: "",
  company: "",
  role: "",
  load: "",
  message: "",
};

const proofPoints = [
  { label: "Initial market", value: "ERCOT / Texas" },
  { label: "Target projects", value: "100-500 MW" },
  { label: "Report cycle", value: "5-10 business days" },
];

const problemCards = [
  {
    icon: MapPin,
    title: "Land is moving faster than grid diligence",
    body: "Data-center teams are evaluating parcels, substations, utilities, and power partners before the interconnection story is clear.",
  },
  {
    icon: Clock3,
    title: "Time-to-power risk is hard to underwrite",
    body: "Investors need an evidence-backed view of grid constraints, likely processes, missing studies, and realistic next steps before capital is committed.",
  },
  {
    icon: ShieldAlert,
    title: "Utility credibility now matters early",
    body: "Large-load projects need to show readiness on ride-through, staging, flexibility, telemetry, backup assumptions, and operational risk.",
  },
];

const workflowSteps = [
  {
    icon: Search,
    title: "Screen the candidate site",
    body: "Capture load profile, location, stage, land control, target energization date, known utility signals, and existing studies.",
  },
  {
    icon: RadioTower,
    title: "Map grid and market context",
    body: "Identify nearby transmission, substations, service territories, possible points of interconnection, congestion exposure, and market constraints.",
  },
  {
    icon: ClipboardCheck,
    title: "Score readiness and risk",
    body: "Structure the diligence around power feasibility, large-load process readiness, reliability risk, economics, and flexibility potential.",
  },
  {
    icon: FileText,
    title: "Deliver the memo and report",
    body: "Give developers and investors a clear proceed, pause, reject, or escalate view with evidence, assumptions, and unresolved diligence items.",
  },
];

const reportModules = [
  {
    icon: Gauge,
    title: "Power feasibility score",
    body: "Substation and transmission proximity, utility territory, point-of-interconnection notes, capacity indicators, and time-to-power constraints.",
  },
  {
    icon: Layers,
    title: "Large-load readiness pack",
    body: "Required information, forms, studies, attestations, commissioning-plan inputs, financial-security considerations, and missing items.",
  },
  {
    icon: AlertTriangle,
    title: "Reliability risk assessment",
    body: "Voltage and frequency ride-through, protection settings, backup generation, telemetry, disturbance response, and operational red flags.",
  },
  {
    icon: LineChart,
    title: "Energy economics view",
    body: "Price-zone context, congestion exposure, nearby generation, potential behind-the-meter options, and indicative power-cost risk.",
  },
  {
    icon: Zap,
    title: "Flexibility potential",
    body: "Curtailment posture, staged ramping, workload shifting, storage, backup generation, and demand-response readiness.",
  },
  {
    icon: Building2,
    title: "Investor and utility memo",
    body: "Plain-English summary of strengths, unresolved risks, critical assumptions, and recommended next diligence actions.",
  },
];

const buyerCards = [
  {
    icon: Server,
    title: "AI data-center developers",
    body: "Screen sites before land acquisition, utility engagement, interconnection requests, and major engineering spend.",
  },
  {
    icon: Landmark,
    title: "Infrastructure investors",
    body: "Validate sponsor power assumptions, time-to-power claims, grid risk, and IC-ready diligence before financing decisions.",
  },
  {
    icon: Users,
    title: "Energy developers and partners",
    body: "Package large-load-ready sites and power projects with credible evidence for data-center customers and capital partners.",
  },
];

const consoleRiskRows = [
  { label: "Transmission proximity", value: "Strong", tone: "green" },
  { label: "Large-load process fit", value: "Needs review", tone: "amber" },
  { label: "Ride-through exposure", value: "Open item", tone: "red" },
  { label: "Flexibility posture", value: "Curtailable", tone: "blue" },
];

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function statusTone(tone: string) {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (tone === "red") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function Home() {
  const [form, setForm] = useState<DemoFormState>(initialDemoForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DemoFormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("GridReady AI demo request");
    const body = encodeURIComponent(
      [
        "Demo request for GridReady AI",
        "",
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Company: ${form.company}`,
        `Role / buyer type: ${form.role || "Not provided"}`,
        `Target load or site count: ${form.load || "Not provided"}`,
        "",
        "Message:",
        form.message || "Not provided",
      ].join("\n"),
    );

    return `mailto:hello@gridready.ai?subject=${subject}&body=${body}`;
  }, [form]);

  function updateField(field: keyof DemoFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitted(false);

    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: "" }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Record<keyof DemoFormState, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Enter your name.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Enter your work email.";
    } else if (!validateEmail(form.email)) {
      nextErrors.email = "Enter a valid work email.";
    }

    if (!form.company.trim()) {
      nextErrors.company = "Enter your company.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(true);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f2] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/50 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="GridReady AI home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <Image src="/gridready-logo.svg" alt="" width={24} height={24} priority />
            </span>
            <span className="truncate text-base font-semibold text-[#1b365d]">GridReady AI</span>
          </a>

          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#problem" className="transition hover:text-[#1b365d]">
              Problem
            </a>
            <a href="#workflow" className="transition hover:text-[#1b365d]">
              Workflow
            </a>
            <a href="#report-scope" className="transition hover:text-[#1b365d]">
              Report scope
            </a>
            <a href="#buyers" className="transition hover:text-[#1b365d]">
              Buyers
            </a>
          </div>

          <a
            href="#demo"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1b365d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#142844] focus:outline-none focus:ring-2 focus:ring-[#1b365d] focus:ring-offset-2"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <span>Book demo</span>
          </a>
        </nav>
      </header>

      <section id="top" className="relative isolate overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(27,54,93,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(27,54,93,0.08)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(31,97,141,0.18),transparent_32%),linear-gradient(180deg,rgba(245,247,242,0.54),#f5f7f2_92%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-10 lg:pt-10">
          <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1b365d]/15 bg-white/76 px-3 py-1 text-sm font-semibold text-[#1b365d] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                ERCOT / Texas large-load intelligence
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.02] text-[#10243f] sm:mt-7 sm:text-6xl lg:text-7xl">
                GridReady AI
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:mt-6 sm:text-xl sm:leading-8">
                Power feasibility and interconnection-readiness diligence for AI data-center developers and
                infrastructure investors before land purchase, underwriting, or large-load submission.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-row">
                <a
                  href="#demo"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#1b365d] px-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#142844] focus:outline-none focus:ring-2 focus:ring-[#1b365d] focus:ring-offset-2 sm:px-5 sm:text-base"
                >
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  Book a demo
                </a>
                <a
                  href="#report-scope"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white/86 px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1b365d]/40 hover:text-[#1b365d] focus:outline-none focus:ring-2 focus:ring-[#1b365d] focus:ring-offset-2 sm:px-5 sm:text-base"
                >
                  See report scope
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3 shadow-xl shadow-slate-900/10 lg:hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-slate-300">Site diligence console</span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                    74 / 100
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[0.92fr_1.08fr] gap-3">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-white/10 bg-[#132f54]">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:22px_22px]" />
                    <div className="absolute left-8 top-10 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_8px_rgba(110,231,183,0.12)]" />
                    <div className="absolute right-9 top-6 h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,0.12)]" />
                    <div className="absolute bottom-7 left-20 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_8px_rgba(252,211,77,0.13)]" />
                    <div className="absolute left-0 top-1/2 h-px w-full bg-sky-200/30" />
                  </div>
                  <div className="space-y-2">
                    {consoleRiskRows.slice(0, 2).map((row) => (
                      <div key={row.label} className="rounded-md bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-600">{row.label}</span>
                          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(row.tone)}`}>
                            {row.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
                {proofPoints.map((point) => (
                  <div key={point.label} className="rounded-lg border border-white/70 bg-white/78 p-3 shadow-sm sm:p-4">
                    <dt className="text-xs text-slate-500 sm:text-sm">{point.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950 sm:text-lg">{point.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative hidden min-h-[540px] lg:block" aria-hidden="true">
              <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-[720px] rounded-xl border border-slate-200 bg-slate-950/95 p-3 shadow-2xl shadow-slate-900/20">
                <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-400">GridReady Site Diligence Console</span>
                </div>

                <div className="grid gap-3 pt-3 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="min-h-[432px] rounded-lg border border-white/10 bg-[#10243f] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-sky-200">Candidate site</p>
                        <p className="mt-1 text-lg font-semibold text-white">West Texas AI Campus</p>
                      </div>
                      <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                        280 MW
                      </span>
                    </div>

                    <div className="relative mt-5 h-56 overflow-hidden rounded-lg border border-white/10 bg-[#132f54]">
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
                      <div className="absolute left-8 top-8 h-28 w-28 rounded-full border border-sky-300/30" />
                      <div className="absolute bottom-7 right-10 h-36 w-36 rounded-full border border-emerald-300/25" />
                      <div className="absolute left-16 top-24 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_10px_rgba(110,231,183,0.12)]" />
                      <div className="absolute right-24 top-14 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_0_10px_rgba(125,211,252,0.12)]" />
                      <div className="absolute bottom-14 left-28 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_0_10px_rgba(252,211,77,0.13)]" />
                      <div className="absolute left-0 top-1/2 h-px w-full bg-sky-200/30" />
                      <div className="absolute left-24 top-0 h-full w-px rotate-12 bg-emerald-200/30" />
                      <div className="absolute bottom-5 left-5 rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur">
                        2 substations within diligence radius
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-white/10 bg-white/7 p-3">
                        <p className="text-xs text-slate-400">Region</p>
                        <p className="mt-1 font-semibold text-white">ERCOT West</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/7 p-3">
                        <p className="text-xs text-slate-400">Stage</p>
                        <p className="mt-1 font-semibold text-white">Pre-LOI</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/7 p-3">
                        <p className="text-xs text-slate-400">Target</p>
                        <p className="mt-1 font-semibold text-white">Q4 2028</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-white p-4 text-slate-950">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-600">Feasibility score</p>
                        <BarChart3 className="h-4 w-4 text-[#1b365d]" />
                      </div>
                      <div className="mt-4 flex items-end gap-3">
                        <span className="text-5xl font-semibold text-[#1b365d]">74</span>
                        <span className="pb-2 text-sm font-medium text-slate-500">/ 100 preliminary</span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-slate-100">
                        <div className="h-2 w-[74%] rounded-full bg-emerald-500" />
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-600">Risk register</p>
                        <ShieldAlert className="h-4 w-4 text-[#1b365d]" />
                      </div>
                      <div className="mt-3 space-y-2">
                        {consoleRiskRows.map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-2">
                            <span className="text-xs font-medium text-slate-600">{row.label}</span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(row.tone)}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-600">Report progress</p>
                        <FileText className="h-4 w-4 text-[#1b365d]" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {["Intake complete", "Grid asset screen", "Interconnection checklist"].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            {item}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                          <span className="h-4 w-4 rounded-full border-2 border-amber-400" />
                          Expert review pending
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="scroll-mt-24 border-y border-slate-200 bg-white py-18 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-[#1b365d]">The execution bottleneck</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              AI infrastructure is being won by teams that can prove time-to-power first.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              GridReady AI turns fragmented site, grid, market, and interconnection diligence into a repeatable
              workflow built for serious large-load decisions.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {problemCards.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className="rounded-lg border border-slate-200 bg-[#f8faf7] p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1b365d] text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 bg-[#eef3ec] py-18 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase text-[#1b365d]">Software-assisted diligence</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                From candidate parcel to board-ready power narrative.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The first product is a focused report workflow, not a generic GIS layer or a broad energy terminal.
                It is built around the diligence questions that decide whether a large-load site should advance.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article key={step.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{step.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="report-scope" className="scroll-mt-24 bg-white py-18 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase text-[#1b365d]">Report scope</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Evidence-backed power feasibility and interconnection readiness.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Each assessment is designed to reduce uncertainty before a team spends months on the wrong parcel,
                overstates an energization date, or walks into a utility conversation unprepared.
              </p>
            </div>
            <a
              href="#demo"
              className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1b365d]/40 hover:text-[#1b365d] focus:outline-none focus:ring-2 focus:ring-[#1b365d] focus:ring-offset-2"
            >
              Book report walkthrough
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reportModules.map((module) => {
              const Icon = module.icon;

              return (
                <article key={module.title} className="rounded-lg border border-slate-200 bg-[#f8faf7] p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#1b365d] shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{module.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{module.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#10243f] py-16 text-white sm:py-18">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-sky-200">Clear diligence boundary</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Built for early-stage decisions, not false certainty.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/12 bg-white/8 p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">What GridReady clarifies</h3>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Whether a site appears power-feasible, which process likely applies, what evidence is missing, and
                which diligence items should be escalated.
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/8 p-5">
              <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">What it does not claim</h3>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                It is not a guaranteed capacity confirmation, official utility study, legal opinion, or replacement
                for licensed engineering diligence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="buyers" className="scroll-mt-24 bg-[#f5f7f2] py-18 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-[#1b365d]">Who it is for</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Serious infrastructure teams below the hyperscaler tier.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {buyerCards.map((buyer) => {
              const Icon = buyer.icon;

              return (
                <article key={buyer.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="h-6 w-6 text-[#1b365d]" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{buyer.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{buyer.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="demo" className="scroll-mt-20 bg-white py-18 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-[#1b365d]">Book a demo</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Bring a candidate site, portfolio, or underwriting question.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              We will walk through the assessment workflow, the report structure, and how GridReady AI can help your
              team pressure-test large-load assumptions before the expensive work begins.
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Site-screening fit for 75 MW+ loads",
                "ERCOT / Texas diligence wedge for initial pilots",
                "Investor and utility-ready narrative for internal decisions",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-slate-200 bg-[#f8faf7] p-5">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-[#1b365d]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-950">Prefer email?</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Reach the GridReady AI team at{" "}
                    <a className="font-semibold text-[#1b365d] underline-offset-4 hover:underline" href="mailto:hello@gridready.ai">
                      hello@gridready.ai
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-slate-200 bg-[#f8faf7] p-5 shadow-sm sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Full name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                  placeholder="Jane Smith"
                />
                {errors.name ? <span className="mt-1 block text-sm font-medium text-rose-700">{errors.name}</span> : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Work email</span>
                <input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                  placeholder="jane@company.com"
                  inputMode="email"
                />
                {errors.email ? <span className="mt-1 block text-sm font-medium text-rose-700">{errors.email}</span> : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  aria-invalid={Boolean(errors.company)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                  placeholder="Company name"
                />
                {errors.company ? <span className="mt-1 block text-sm font-medium text-rose-700">{errors.company}</span> : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Role / buyer type</span>
                <select
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                >
                  <option value="">Select one</option>
                  <option value="Data-center developer">Data-center developer</option>
                  <option value="Infrastructure investor">Infrastructure investor</option>
                  <option value="Energy developer">Energy developer</option>
                  <option value="Landowner or broker">Landowner or broker</option>
                  <option value="Consultant">Consultant</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Target load or site count</span>
                <input
                  value={form.load}
                  onChange={(event) => updateField("load", event.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                  placeholder="Example: 180 MW site, 6-site screening pack, or investor underwriting review"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Message</span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20"
                  placeholder="Tell us what you are evaluating and when power matters."
                />
              </label>
            </div>

            {submitted ? (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Your demo request is ready.</p>
                    <p className="mt-1 leading-6">
                      Send it to{" "}
                      <a className="font-semibold underline-offset-4 hover:underline" href={mailtoHref}>
                        hello@gridready.ai
                      </a>{" "}
                      so the team can follow up.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#1b365d] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[#142844] focus:outline-none focus:ring-2 focus:ring-[#1b365d] focus:ring-offset-2"
            >
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              Book demo
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#f5f7f2]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/gridready-logo.svg" alt="" width={24} height={24} />
            <span className="font-semibold text-[#1b365d]">GridReady AI</span>
          </div>
          <p>Power-feasibility intelligence for AI data-center and large-load development.</p>
        </div>
      </footer>
    </main>
  );
}
