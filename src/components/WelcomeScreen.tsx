import { Stack, Text, Button, Title } from "@mantine/core";
import { IconFolderPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface WelcomeScreenProps {
  onCreateProject: () => void;
}

export function WelcomeScreen({ onCreateProject }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <Stack align="center" justify="center" style={{ height: "calc(100vh - 50px)" }} gap="xl">
      <div
        style={{
          width: 80, height: 80, borderRadius: 20,
          backgroundColor: "rgba(249, 115, 22, 0.08)",
          border: "1px solid rgba(249, 115, 22, 0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <IconFolderPlus size={40} stroke={1.2} color="var(--mantine-color-brand-5)" />
      </div>
      <Stack align="center" gap={4}>
        <Title order={2} style={{ fontWeight: 600 }}>{t("project.welcome")}</Title>
        <Text c="dimmed" size="sm">{t("project.welcomeDescription")}</Text>
      </Stack>
      <Button leftSection={<IconFolderPlus size={18} stroke={1.5} />} onClick={onCreateProject} color="brand" radius="md" size="md">
        {t("project.create")}
      </Button>
    </Stack>
  );
}
