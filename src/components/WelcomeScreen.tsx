import { Stack, Text, Button, Title } from "@mantine/core";
import { IconFolderPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface WelcomeScreenProps {
  onCreateProject: () => void;
}

export function WelcomeScreen({ onCreateProject }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <Stack
      align="center"
      justify="center"
      style={{ height: "calc(100vh - 50px)" }}
      gap="lg"
    >
      <IconFolderPlus
        size={64}
        stroke={1}
        color="var(--mantine-color-dimmed)"
      />
      <Title order={3} c="dimmed">
        {t("project.welcome")}
      </Title>
      <Text c="dimmed" size="sm">
        {t("project.welcomeDescription")}
      </Text>
      <Button
        leftSection={<IconFolderPlus size={18} />}
        onClick={onCreateProject}
      >
        {t("project.create")}
      </Button>
    </Stack>
  );
}
