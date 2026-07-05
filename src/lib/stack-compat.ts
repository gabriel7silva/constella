/**
 * Stack compatibility — the system understands which picks fit together so the
 * operator can't quietly assemble an incoherent stack (e.g. a Python backend with
 * a Node runtime, or a second ORM on top of Django's built-in one). Returns a
 * reason string when an option is incompatible with the current selection (used
 * to disable the card + show why), or null when it's fine.
 */
import { splitStack, joinStack, primaryStack } from "@/lib/stack-multi";
import { STACK_CATS } from "@/data/stack-catalog";

type Fam = "js" | "py" | "jvm" | "dotnet" | "go" | "rust" | "php" | "ruby" | "elixir" | "other";

const LANG_FAMILY: Record<string, Fam> = {
  TypeScript: "js", JavaScript: "js", Python: "py", Go: "go", Rust: "rust",
  Java: "jvm", Kotlin: "jvm", Scala: "jvm", "C#": "dotnet", Ruby: "ruby",
  PHP: "php", Elixir: "elixir", Swift: "other", "C++": "other", Dart: "other",
};
const RUNTIME_FAMILY: Record<string, Fam> = { "Node.js": "js", Bun: "js", Deno: "js", "Python 3": "py", PyPy: "py", JVM: "jvm", ".NET": "dotnet", "BEAM (Erlang VM)": "elixir" };
const BACKEND_FAMILY: Record<string, Fam> = {
  NestJS: "js", Fastify: "js", Express: "js", Hono: "js", Koa: "js", AdonisJS: "js",
  Django: "py", Flask: "py", FastAPI: "py", "Spring Boot": "jvm", Spring: "jvm", Laravel: "php",
  Symfony: "php", CodeIgniter: "php",
  "Ruby on Rails": "ruby", Gin: "go", Fiber: "go", Actix: "rust", Phoenix: "elixir", "ASP.NET Core": "dotnet",
  // GraphQL + Nginx are language-agnostic (no family → no constraint).
};
const ORM_FAMILY: Record<string, Fam> = {
  Prisma: "js", Drizzle: "js", TypeORM: "js", Sequelize: "js", Knex: "js", Mongoose: "js",
  SQLAlchemy: "py", "Django ORM": "py", GORM: "go", Diesel: "rust",
};
const FAM_LABEL: Record<Fam, string> = { js: "JavaScript/TypeScript", py: "Python", jvm: "JVM", dotnet: ".NET", go: "Go", rust: "Rust", php: "PHP", ruby: "Ruby", elixir: "Elixir", other: "this" };

export function incompat(stack: Record<string, string>, catKey: string, value: string): string | null {
  // Categories can hold multiple picks; family-based checks key off the PRIMARY language, and the
  // backend/database checks look across ALL picks in their category.
  const fam = LANG_FAMILY[primaryStack(stack.language)];
  const databases = splitStack(stack.database);
  const backends = splitStack(stack.backend);

  if (catKey === "runtime") {
    const rf = RUNTIME_FAMILY[value];
    if (fam && rf && rf !== fam) return `Needs a ${FAM_LABEL[rf]} language`;
  }
  if (catKey === "backend") {
    const bf = BACKEND_FAMILY[value];
    if (fam && bf && bf !== fam) return `Requires a ${FAM_LABEL[bf]} language`;
  }
  if (catKey === "orm") {
    const of = ORM_FAMILY[value];
    if (fam && of && of !== fam) return `${FAM_LABEL[of]} only`;
    if (value === "Mongoose" && databases.length > 0 && !databases.includes("MongoDB")) return "Mongoose needs MongoDB";
    if (value === "Django ORM" && !backends.includes("Django")) return "Only with Django";
    if (backends.includes("Django") && value !== "Django ORM" && value !== "None") return "Django already ships its own ORM";
  }
  return null;
}

export type StackRemoval = { cat: string; opt: string; reason: string };

/**
 * Enforce the invariant **no blocked option stays selected**. Scans every category's picks and drops any
 * that are now incompatible with the rest of the stack — looping to a fixpoint so cascading conflicts
 * settle (e.g. picking Python drops Node.js, which can in turn free/flip a dependent ORM rule). Returns the
 * CLEANED stack plus the list of what was auto-removed (and why), so the UI can deselect them and tell the
 * user, and the save paths can never persist an invalid combination. `language` is never removed (it's the
 * family anchor); "None" is never removed (it's the explicit skip sentinel).
 */
export function reconcileStack(stack: Record<string, string>): { stack: Record<string, string>; removed: StackRemoval[] } {
  let s: Record<string, string> = { ...stack };
  const removed: StackRemoval[] = [];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const cat of STACK_CATS) {
      const opts = splitStack(s[cat.key]);
      if (!opts.length) continue;
      const keep: string[] = [];
      for (const o of opts) {
        const reason = o === "None" ? null : incompat(s, cat.key, o);
        if (reason) { removed.push({ cat: cat.key, opt: o, reason }); changed = true; }
        else keep.push(o);
      }
      if (keep.length !== opts.length) s = { ...s, [cat.key]: joinStack(keep) };
    }
  }
  return { stack: s, removed };
}

/** A short, human note when the current stack has a redundancy worth surfacing. */
export function stackNote(stack: Record<string, string>): string | null {
  const extraOrms = splitStack(stack.orm).filter((o) => !["Django ORM", "None"].includes(o));
  if (splitStack(stack.backend).includes("Django") && extraOrms.length > 0) {
    return `Django includes its own ORM — a second ORM (${extraOrms.join(", ")}) is usually redundant.`;
  }
  return null;
}
