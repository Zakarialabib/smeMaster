import { useTranslation } from "react-i18next";
import { Modal } from "@shared/components/ui/Modal";
import { ContactEditor } from "@features/contacts/components/settings/ContactEditor";
import { SubscriptionManager } from "@features/settings/components/SubscriptionManager";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactSettingsModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.contactSettings.title')} size="xl">
      <div className="max-h-[80vh] overflow-y-auto space-y-6 p-1">
        <ContactEditor />
        <SubscriptionManager />
      </div>
    </Modal>
  );
}
