import { useTranslation } from "react-i18next";

import { ProfileButton } from "@/features/account/profile-button";
import { ComingSoon } from "@/ui/coming-soon";

export default function Create() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.create")} action={<ProfileButton />} />;
}
