import type { Route } from "next";
import type { IconName } from "@/components/ui/icon";

export type ModuleDef = { id: string; title: string; href: Route; group: string; tile: string; icon: IconName };

export const MODULE_GROUPS = ["Cockpit", "Hierarchy", "Execution", "Product", "Knowledge", "Operations", "Inbox", "System"] as const;

export const MODULES: ModuleDef[] = [
  { id: "home", title: "Home", href: "/", group: "Cockpit", tile: "Welcome — canonical knowledge & quick navigation", icon: "grid" },
  { id: "dashboard", title: "Dashboard", href: "/dashboard" as Route, group: "Cockpit", tile: "Cockpit hub — status at a glance", icon: "pulse" },
  { id: "organizations", title: "Organizations", href: "/organizations", group: "Hierarchy", tile: "Manage organizations & workspaces", icon: "grid" },
  { id: "org", title: "Org Chart", href: "/org", group: "Hierarchy", tile: "Hierarchy & delegation", icon: "agents" },
  { id: "agents", title: "Agent Studio", href: "/agents/ada" as Route, group: "Hierarchy", tile: "Configure each agent", icon: "bot" },
  { id: "code", title: "Code", href: "/code", group: "Execution", tile: "Code editor & repo files", icon: "terminal" },
  { id: "tasks", title: "Tasks", href: "/tasks", group: "Execution", tile: "Team kanban board", icon: "files" },
  { id: "cron", title: "Cron", href: "/cron", group: "Execution", tile: "Scheduled tasks & history", icon: "calendar" },
  { id: "routines", title: "Routines", href: "/routines", group: "Execution", tile: "Recurring automations", icon: "repeat" },
  { id: "goals", title: "Goals", href: "/goals", group: "Execution", tile: "Objective tree", icon: "target" },
  { id: "design", title: "Design", href: "/design" as Route, group: "Execution", tile: "Prototype the UI with the frontend agent before the plan", icon: "grid" },
  { id: "planner", title: "CEO Planner", href: "/planner", group: "Execution", tile: "Specs → issues → approval → 24/7", icon: "command" },
  { id: "test-dev", title: "Test Dev", href: "/test-dev" as Route, group: "Execution", tile: "Boot, navigate + validate the project", icon: "play" },
  { id: "pm", title: "Product Manager", href: "/pm", group: "Product", tile: "Sprints & backlog (PO)", icon: "goto" },
  { id: "reports", title: "Reports", href: "/reports", group: "Knowledge", tile: "Plans, reviews, audits", icon: "doc" },
  { id: "docs", title: "Docs", href: "/docs", group: "Knowledge", tile: "Architecture, API & PO docs", icon: "doc" },
  { id: "skills", title: "Skills", href: "/skills", group: "Knowledge", tile: "Agent procedure library", icon: "skill" },
  { id: "activity", title: "Activity", href: "/activity", group: "Knowledge", tile: "Agent action timeline", icon: "pulse" },
  { id: "knowledge", title: "Knowledge", href: "/knowledge" as Route, group: "Knowledge", tile: "KB index, coverage, gaps & agent recall", icon: "branch" },
  { id: "costs", title: "Costs", href: "/costs", group: "Operations", tile: "Spend by agent/provider", icon: "coins" },
  { id: "security", title: "Security", href: "/security", group: "Operations", tile: "Findings & security score", icon: "shield" },
  { id: "pulse", title: "Pulse", href: "/pulse", group: "Operations", tile: "Agent health & validation", icon: "pulse" },
  { id: "github", title: "Commit GitHub", href: "/github", group: "Operations", tile: "Push workspace to remote", icon: "git" },
  { id: "prepare-deploy", title: "Prepare Deploy", href: "/prepare-deploy" as Route, group: "Operations", tile: "Prod-prep + export clean source to a deploy repo", icon: "goto" },
  { id: "models", title: "Models", href: "/models", group: "Operations", tile: "Providers & local models", icon: "cpu" },
  { id: "update", title: "Update", href: "/update" as Route, group: "Operations", tile: "Detect & apply new versions", icon: "goto" },
  { id: "plugins", title: "Plugins", href: "/plugins", group: "Operations", tile: "Extensions & integrations", icon: "ext" },
  { id: "inbox", title: "Inbox", href: "/inbox", group: "Inbox", tile: "Approvals & escalations", icon: "inbox" },
  { id: "notifications", title: "Notifications", href: "/notifications", group: "Inbox", tile: "Passive alert feed", icon: "bell" },
  { id: "config", title: "Config", href: "/config", group: "System", tile: "Platform settings", icon: "settings" },
  { id: "profile", title: "Profile", href: "/profile", group: "System", tile: "Account & preferences", icon: "account" },
];
