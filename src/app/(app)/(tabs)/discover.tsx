import { useTranslation } from "react-i18next";

import { ProfileButton } from "@/features/account/profile-button";
import { Catalogue } from "@/features/submissions/catalogue";
import { Screen } from "@/ui/screen";

// For now Discover is the catalogue (S-24); search and the events map join it later (06.3, 05.1).
export default function Discover() {
  const { t } = useTranslation();
  return (
    <Screen title={t("nav.discover")} action={<ProfileButton />}>
      <Catalogue initialTab="publications" />
    </Screen>
  );
}
