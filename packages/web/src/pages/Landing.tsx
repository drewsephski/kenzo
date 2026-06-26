import { useEffect, useMemo, useState } from "preact/hooks";
import { route, RoutableProps } from "preact-router";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  CommandLineIcon,
  RectangleStackIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { APP_NAME } from "../brand";
import { BrandMark, ThemeToggle } from "../components";
import { getProjects, type ProjectWithStats } from "../stores";

const workflowRows = [
  { label: "Planning", title: "Turn rough intent into a scoped lane", tone: "badge-info" },
  { label: "Todo", title: "Pick the next ready move", tone: "badge-primary" },
  { label: "In progress", title: "Keep the active work visible", tone: "badge-warning" },
  { label: "Done", title: "Close the loop with proof", tone: "badge-success" },
];

const focusPoints = [
  {
    icon: RectangleStackIcon,
    title: "Boards stay close to the work",
    body: "Projects, workstreams, waiting items, and status move in the same surface your team already uses.",
  },
  {
    icon: CommandLineIcon,
    title: "Agents get a real operating layer",
    body: "The command line and agent interface keep task context explicit instead of scattered through chat history.",
  },
  {
    icon: BoltIcon,
    title: "The next action is never buried",
    body: "Priority, dependencies, and live updates make the board useful during execution, not just planning.",
  },
];

export function Landing(_props: RoutableProps) {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);

  useEffect(() => {
    getProjects()
      .then((items) => {
        setProjects(items);
        setApiOnline(true);
      })
      .catch(() => {
        setProjects([]);
        setApiOnline(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const primaryProject = useMemo(() => {
    return projects.find((project) => project.stats.done < project.stats.total) ?? projects[0];
  }, [projects]);

  const openBoard = () => {
    if (primaryProject) {
      route(`/board/${primaryProject.id}`);
      return;
    }
    route("/new");
  };

  const primaryLabel = primaryProject ? `Open ${primaryProject.name} board` : "Create your first board";

  return (
    <main class="min-h-screen bg-base-200 text-base-content">
      <header class="navbar bg-base-100/95 shadow-lg">
        <div class="flex-1 px-2">
          <BrandMark />
        </div>
        <div class="flex-none flex items-center gap-2">
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => route("/projects")}>
            Projects
          </button>
          <ThemeToggle />
        </div>
      </header>

      <section class="px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div class="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div class="space-y-6">
            <div class="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-1 text-sm text-base-content/70 shadow-sm">
              <SparklesIcon className="h-4 w-4 text-primary" />
              Kenzo, powered by the Flux engine
            </div>

            <div class="space-y-4">
              <h1 class="max-w-3xl text-4xl font-black leading-[0.98] tracking-normal text-base-content sm:text-5xl lg:text-6xl">
                Run the next move from one visible board.
              </h1>
              <p class="max-w-2xl text-base leading-7 text-base-content/70 sm:text-lg">
                {APP_NAME} gives human operators and AI agents the same source of truth for priorities,
                blockers, handoffs, and finished work.
              </p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <button type="button" class="btn btn-primary" onClick={openBoard} disabled={loading}>
                {loading ? <span class="loading loading-spinner loading-sm"></span> : primaryLabel}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => route("/projects")}>
                View all projects
              </button>
            </div>

            {!apiOnline && (
              <div class="alert alert-warning max-w-xl">
                <span>The API is offline. Start the server, then refresh to open a live board.</span>
              </div>
            )}
          </div>

          <div class="relative min-h-[420px] overflow-hidden rounded-lg border border-base-300 bg-base-100 p-4 shadow-xl">
            <div class="flex items-center justify-between border-b border-base-200 pb-3">
              <div>
                <div class="text-sm font-semibold">{primaryProject?.name ?? "Kenzo board"}</div>
                <div class="text-xs text-base-content/50">Live execution rail</div>
              </div>
              <div class="badge badge-outline">{projects.length || 1} project{(projects.length || 1) === 1 ? "" : "s"}</div>
            </div>

            <div class="mt-5 grid gap-3">
              {workflowRows.map((row, index) => (
                <div
                  key={row.label}
                  class={`group grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-lg border border-base-200 bg-base-200/60 p-3 transition-transform hover:-translate-y-0.5 ${
                    index === 2 ? "translate-x-3 border-primary/40 bg-primary/10" : ""
                  }`}
                >
                  <span class={`badge badge-soft badge-sm ${row.tone}`}>{row.label}</span>
                  <span class="text-sm font-medium">{row.title}</span>
                  {index === 3 ? (
                    <CheckCircleIcon className="h-5 w-5 text-success" />
                  ) : (
                    <span class="h-2 w-2 rounded-full bg-base-content/30 group-hover:bg-primary"></span>
                  )}
                </div>
              ))}
            </div>

            <div class="mt-5 grid grid-cols-3 gap-3 text-center">
              <div class="rounded-lg border border-base-200 bg-base-100 p-3">
                <div class="text-2xl font-black">{primaryProject?.stats.total ?? 4}</div>
                <div class="text-xs text-base-content/50">tasks tracked</div>
              </div>
              <div class="rounded-lg border border-base-200 bg-base-100 p-3">
                <div class="text-2xl font-black">{primaryProject?.stats.done ?? 1}</div>
                <div class="text-xs text-base-content/50">closed loops</div>
              </div>
              <div class="rounded-lg border border-base-200 bg-base-100 p-3">
                <div class="text-2xl font-black">{primaryProject ? primaryProject.stats.total - primaryProject.stats.done : 3}</div>
                <div class="text-xs text-base-content/50">next moves</div>
              </div>
            </div>

            <div class="absolute bottom-4 right-4 hidden max-w-[220px] rotate-[-2deg] rounded-lg border border-neutral bg-neutral p-3 text-neutral-content shadow-2xl sm:block">
              <div class="text-xs uppercase text-neutral-content/60">Agent note</div>
              <div class="mt-1 text-sm font-semibold">Start from ready work. Finish with evidence.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="px-4 pb-20 sm:px-6 lg:px-8">
        <div class="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {focusPoints.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} class="rounded-lg border border-base-300 bg-base-100 p-5 shadow-sm">
                <Icon className="h-6 w-6 text-primary" />
                <h2 class="mt-4 text-lg font-bold">{item.title}</h2>
                <p class="mt-2 text-sm leading-6 text-base-content/65">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
