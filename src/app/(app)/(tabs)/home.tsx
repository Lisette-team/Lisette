import { useTranslation } from "react-i18next";

import { ProfileButton } from "@/features/account/profile-button";
import { ComingSoon } from "@/ui/coming-soon";

export default function Home() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.home")} action={<ProfileButton />} />;
}
