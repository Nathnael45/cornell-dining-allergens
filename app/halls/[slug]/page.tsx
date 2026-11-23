import { Suspense } from "react";
import { BandLoading } from "@/components/band";
import { DayView } from "@/components/day-view";

export default function HallPage(props: PageProps<"/halls/[slug]">) {
  return (
    <Suspense fallback={<BandLoading text="Loading menu…" />}>
      <Hall params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Hall({ params, searchParams }: { params: PageProps<"/halls/[slug]">["params"]; searchParams: PageProps<"/halls/[slug]">["searchParams"] }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return <DayView sp={sp} slug={slug} />;
}
