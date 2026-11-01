"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceProps } from "@/components/coding/coding-workspace";

// The editor is browser-only and heavy, so it's split out of the page bundle
// and never server-rendered.
const CodingWorkspace = dynamic(
  () => import("@/components/coding/coding-workspace").then((m) => m.CodingWorkspace),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[max(34rem,calc(100dvh-10rem))] w-full rounded-xl" />,
  },
);

export function CodingWorkspaceLoader(props: WorkspaceProps) {
  return <CodingWorkspace {...props} />;
}
