import { useCallback, useState } from "react";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { ProfileButton } from "@/features/account/profile-button";
import { useSession } from "@/features/account/session";
import { supabase } from "@/lib/supabase";
import { ListRow } from "@/ui/list-row";
import { Segmented } from "@/ui/segmented";
import { ErrorText, Screen } from "@/ui/screen";

type Row = { id: string; status: string; work_title: string; author_name: string; opened: boolean };
export default function Submissions() {
 const { t } = useTranslation(); const session = useSession(); const [rows, setRows] = useState<Row[]>([]); const [error, setError] = useState(false); const [filter, setFilter] = useState<"all" | "unopened" | "opened">("all"); const publisherId = session?.kind === "publisher" ? session.userId : null;
 useFocusEffect(useCallback(() => { if (!publisherId) return; void (async () => {
  const result = await supabase.from("submissions").select("id").eq("publisher_id", publisherId).order("submitted_at", { ascending: false });
  if (result.error) { setError(true); return; }
  const details = await Promise.all(result.data.map(({ id }) => supabase.rpc("submission_detail", { submission_id: id })));
  if (details.some((d) => d.error)) { setError(true); return; }
  setRows(details.map((d) => d.data as Row).filter(Boolean)); setError(false);
 })(); }, [publisherId]));
 if (session && session.kind !== "publisher") return <Redirect href="/home" />;
 return <Screen title={t("nav.submissions")} action={<ProfileButton />}>
 <Segmented<"all" | "unopened" | "opened"> value={filter} onChange={setFilter} options={[{ value: "all", label: t("publisher.allSubmissions") }, { value: "unopened", label: t("publisher.unopened") }, { value: "opened", label: t("publisher.opened") }]} />
 {error ? <ErrorText>{t("errors.network")}</ErrorText> : null}
 {rows.filter((row) => filter === "all" || row.opened === (filter === "opened")).map((row) => <ListRow key={row.id} title={row.author_name} subtitle={row.work_title} meta={`${t(`manuscripts.status_${row.status}`)} · ${t(row.opened ? "publisher.opened" : "publisher.unopened")}`} onPress={() => router.push(`/submission/${row.id}`)} />)}
 {!rows.length && !error ? <Text>{t("publisher.inboxEmpty")}</Text> : null}
 </Screen>;
}
