"use client";

import { useRouter } from "next/navigation";
import { Followups } from "./apply-form";

/** Unanswered AI follow-up questions on the application page. */
export function FollowupsCard(props: { applicationId: string; company: string; questions: { id: string; question: string }[] }) {
  const router = useRouter();
  return (
    <Followups
      applicationId={props.applicationId}
      company={props.company}
      initial={props.questions}
      onDone={() => router.refresh()}
    />
  );
}
