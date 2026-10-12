import { OperatorHub } from "@/components/OperatorHub";
import { OPERATOR_IDS } from "@/lib/operators";

export function generateStaticParams() {
  return OPERATOR_IDS.map((id) => ({ id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OperatorHub id={id} />;
}
