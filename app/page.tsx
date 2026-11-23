import { Suspense } from "react";
import { BandLoading } from "@/components/band";
import { DayView } from "@/components/day-view";

export default function Home(props: PageProps<"/">) {
  return (
    <Suspense fallback={<BandLoading text="Loading menus…" />}>
      <Overview searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  return <DayView sp={await searchParams} />;
}
