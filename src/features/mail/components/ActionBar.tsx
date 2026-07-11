import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Thread } from "@features/mail/stores/threadStore";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useActiveLabel } from "@shared/hooks/useRouteNavigation";
import { archiveThread, trashThread, permanentDeleteThread, markThreadRead, starThread, spamThread } from "@features/mail/services/emailActions";
import { deleteThread as deleteThreadFromDb, pinThread as pinThreadDb, unpinThread as unpinThreadDb, muteThread as muteThreadDb, unmuteThread as unmuteThreadDb } from "@shared/services/db/threads";
import { deleteDraftsForThread } from "@features/mail/services/gmail/draftDeletion";
import { snoozeThread } from "@features/mail/services/snooze/snoozeManager";
import { getGmailClient } from "@features/mail/services/gmail/tokenManager";
import { SnoozeDialog } from "./SnoozeDialog";
import { FollowUpDialog } from "./FollowUpDialog";
import { Archive, Trash2, MailOpen, Mail, Star, Clock, Ban, Pin, MailMinus, BellRing, VolumeX, Reply, ReplyAll, Forward, FolderInput, Printer, Download, ExternalLink, PanelRightClose, PanelRightOpen, ListTodo, MoreHorizontal } from "lucide-react";
import type { DbMessage } from "@shared/services/db/messages";
import { insertFollowUpReminder, getFollowUpForThread, cancelFollowUpForThread } from "@features/settings/db/followUpReminders";
import { Button } from "@shared/components/ui/Button";
import { useClickOutside } from "@shared/hooks/useClickOutside";
import { useShortcutTooltip, TooltipPopup } from "@shared/hooks/useShortcutTooltip";

interface ActionBarProps {
  thread: Thread;
  messages?: DbMessage[];
  noReply?: boolean;
  defaultReplyMode?: "reply" | "replyAll";
  contactSidebarVisible?: boolean;
  taskSidebarVisible?: boolean;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  onPopOut?: () => void;
  onToggleContactSidebar?: () => void;
  onToggleTaskSidebar?: () => void;
  isMobile?: boolean;
}

function Separator() {
  return <div className="w-px h-5 bg-border-secondary mx-1 shrink-0" role="separator" />;
}

export function ActionBar({ thread, messages, noReply, defaultReplyMode = "reply", contactSidebarVisible, taskSidebarVisible, onReply, onReplyAll, onForward, onPrint, onExport, onPopOut, onToggleContactSidebar, onToggleTaskSidebar, isMobile = false }: ActionBarProps) {
  const { t } = useTranslation();
  const updateThread = useThreadStore((s) => s.updateThread);
  const removeThread = useThreadStore((s) => s.removeThread);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const activeLabel = useActiveLabel();
  const [showSnooze, setShowSnooze] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [hasFollowUp, setHasFollowUp] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const isSpamView = activeLabel === "spam";
  const hasLastMessage = !!messages?.length;

  useClickOutside(overflowRef, () => setShowOverflow(false));

  // ── Shortcut tooltips ────────────────────────────────────────────────
  const archiveTooltip = useShortcutTooltip("E");
  const trashTooltip = useShortcutTooltip("T");
  const markReadTooltip = useShortcutTooltip("Q");
  const starTooltip = useShortcutTooltip("S");
  const snoozeTooltip = useShortcutTooltip("B");
  const spamTooltip = useShortcutTooltip("!");

  // Check if thread has an active follow-up reminder
  useEffect(() => {
    if (!activeAccountId) return;
    getFollowUpForThread(activeAccountId, thread.id)
      .then((r) => setHasFollowUp(r !== null))
      .catch(() => setHasFollowUp(false));
  }, [activeAccountId, thread.id]);

  const handleToggleRead = async () => {
    if (!activeAccountId) return;
    await markThreadRead(activeAccountId, thread.id, [], !thread.isRead);
  };

  const handleToggleStar = async () => {
    if (!activeAccountId) return;
    await starThread(activeAccountId, thread.id, [], !thread.isStarred);
  };

  const handleArchive = async () => {
    if (!activeAccountId) return;
    await archiveThread(activeAccountId, thread.id, []);
  };

  const handleDelete = async () => {
    if (!activeAccountId) return;
    const isTrashView = activeLabel === "trash";
    const isDraftsView = activeLabel === "drafts";
    if (isTrashView) {
      await permanentDeleteThread(activeAccountId, thread.id, []);
      await deleteThreadFromDb(activeAccountId, thread.id);
    } else if (isDraftsView) {
      removeThread(thread.id);
      try {
        const client = await getGmailClient(activeAccountId);
        await deleteDraftsForThread(client, activeAccountId, thread.id);
      } catch (err) {
        console.error("Failed to delete drafts:", err);
      }
    } else {
      await trashThread(activeAccountId, thread.id, []);
    }
  };

  const handleSnooze = async (until: number) => {
    if (!activeAccountId) return;
    setShowSnooze(false);
    // Optimistically remove the thread (stash keeps a copy for rollback)
    const stashed = useThreadStore.getState().stashThread(thread.id);
    try {
      await snoozeThread(activeAccountId, thread.id, until);
    } catch (err) {
      console.error("Failed to snooze:", err);
      // Rollback: restore the thread if the operation failed
      if (stashed) {
        useThreadStore.getState().unstashThread(thread.id);
      }
    }
  };

  const handleSpam = async () => {
    if (!activeAccountId) return;
    await spamThread(activeAccountId, thread.id, [], !isSpamView);
  };

  // Find the first message with an unsubscribe header
  const unsubscribeMessage = messages?.find((m) => m.list_unsubscribe);
  const hasUnsubscribe = !!unsubscribeMessage?.list_unsubscribe;
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleUnsubscribe = async () => {
    if (!unsubscribeMessage?.list_unsubscribe || !activeAccountId) return;
    setUnsubscribeStatus("loading");
    try {
      const { executeUnsubscribe } = await import("@features/mail/services/unsubscribe/unsubscribeManager");
      const result = await executeUnsubscribe(
        activeAccountId,
        thread.id,
        unsubscribeMessage.from_address ?? "unknown",
        unsubscribeMessage.from_name,
        unsubscribeMessage.list_unsubscribe,
        unsubscribeMessage.list_unsubscribe_post,
      );
      if (result.success) {
        setUnsubscribeStatus("done");
        // Auto-archive after successful unsubscribe
        await archiveThread(activeAccountId, thread.id, []);
      } else {
        setUnsubscribeStatus("idle");
      }
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
      setUnsubscribeStatus("idle");
    }
  };

  const handleTogglePin = async () => {
    if (!activeAccountId) return;
    const newPinned = !thread.isPinned;
    updateThread(thread.id, { isPinned: newPinned });
    try {
      if (newPinned) {
        await pinThreadDb(activeAccountId, thread.id);
      } else {
        await unpinThreadDb(activeAccountId, thread.id);
      }
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      updateThread(thread.id, { isPinned: !newPinned });
    }
  };

  const handleToggleMute = async () => {
    if (!activeAccountId) return;
    const newMuted = !thread.isMuted;
    if (newMuted) {
      // Mute: mark as muted and archive
      updateThread(thread.id, { isMuted: true });
      try {
        await muteThreadDb(activeAccountId, thread.id);
        await archiveThread(activeAccountId, thread.id, []);
      } catch (err) {
        console.error("Failed to mute:", err);
        await unmuteThreadDb(activeAccountId, thread.id);
        updateThread(thread.id, { isMuted: false });
      }
    } else {
      // Unmute
      updateThread(thread.id, { isMuted: false });
      try {
        await unmuteThreadDb(activeAccountId, thread.id);
      } catch (err) {
        console.error("Failed to unmute:", err);
        updateThread(thread.id, { isMuted: true });
      }
    }
  };

  const handleFollowUp = async (remindAt: number) => {
    if (!activeAccountId || !messages || messages.length === 0) return;
    setShowFollowUp(false);
    const lastMsg = messages[messages.length - 1]!;
    try {
      await insertFollowUpReminder(activeAccountId, thread.id, lastMsg.id, remindAt);
      setHasFollowUp(true);
    } catch (err) {
      console.error("Failed to set follow-up reminder:", err);
    }
  };

  const handleCancelFollowUp = async () => {
    if (!activeAccountId) return;
    try {
      await cancelFollowUpForThread(activeAccountId, thread.id);
      setHasFollowUp(false);
    } catch (err) {
      console.error("Failed to cancel follow-up:", err);
    }
  };

  // Stable aria labels — computed once per render via useMemo
  const ariaLabels = useMemo(() => ({
    reply: defaultReplyMode === "replyAll" ? t("email.replyAllShortcut") : t("email.replyShortcut"),
    replyAlt: defaultReplyMode === "replyAll" ? t("email.replyShortcut") : t("email.replyAllShortcut"),
    forward: t("email.forwardShortcut"),
    archive: t("email.archiveShortcut"),
    delete: t("email.deleteShortcut"),
    markRead: thread.isRead ? t("email.markUnread") : t("email.markRead"),
    star: thread.isStarred ? t("email.unstarShortcut") : t("email.starShortcut"),
    snooze: t("email.snoozeShortcut"),
    spam: isSpamView ? t('email.notSpamShortcut') : t('email.reportSpamShortcut'),
    moveToFolder: t('email.moveToFolderShortcut'),
    pin: thread.isPinned ? t('email.unpinShortcut') : t('email.pinShortcut'),
    mute: thread.isMuted ? t('email.unmuteShortcut') : t('email.muteShortcut'),
    followUp: hasFollowUp ? t('email.cancelFollowUp') : t('email.remindIfNoReply'),
    unsubscribe: unsubscribeStatus === "loading" ? t('email.unsubscribing') : unsubscribeStatus === "done" ? t('actionBar.unsubscribed') : t('actionBar.unsubscribe'),
    print: t('email.print'),
    export: t('email.exportAsEml'),
    popOut: t("composer.openInNewWindow"),
    taskSidebar: taskSidebarVisible ? t('email.hideTaskPanel') : t('email.showTaskPanel'),
    contactSidebar: contactSidebarVisible ? t('email.hideContactSidebar') : t('email.showContactSidebar'),
  }), [defaultReplyMode, t, thread.isRead, thread.isStarred, isSpamView, thread.isPinned, thread.isMuted, hasFollowUp, unsubscribeStatus, taskSidebarVisible, contactSidebarVisible]);

  return (
    <>
      <div className={`flex flex-wrap items-center justify-between ${isMobile ? "gap-0.5 px-2 py-1.5" : "gap-1 px-3 py-3"} border-b border-border-secondary bg-bg-secondary`} role="toolbar" aria-label={t("email.threadActions")}>
        {/* Reply / Forward group */}
        {hasLastMessage && (
          <>
            <Button
              variant="secondary"
              onClick={defaultReplyMode === "replyAll" ? onReplyAll : onReply}
              disabled={noReply}
              title={noReply ? t("email.thisSenderAcceptsNoReplies") : ariaLabels.reply}
              aria-label={noReply ? t("email.thisSenderAcceptsNoReplies") : ariaLabels.reply}
              className={`disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
            >
              {defaultReplyMode === "replyAll" ? <ReplyAll size={isMobile ? 16 : 15} /> : <Reply size={isMobile ? 16 : 15} />}
            </Button>
            <Button
              variant="secondary"
              onClick={defaultReplyMode === "replyAll" ? onReply : onReplyAll}
              disabled={noReply}
              title={noReply ? t("email.thisSenderAcceptsNoReplies") : ariaLabels.replyAlt}
              aria-label={noReply ? t("email.thisSenderAcceptsNoReplies") : ariaLabels.replyAlt}
              className={`disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
            >
              {defaultReplyMode === "replyAll" ? <Reply size={isMobile ? 16 : 15} /> : <ReplyAll size={isMobile ? 16 : 15} />}
            </Button>
            <Button
              variant="secondary"
              onClick={onForward}
              title={ariaLabels.forward}
              aria-label={ariaLabels.forward}
              className={isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}
            >
              <Forward size={isMobile ? 16 : 15} />
            </Button>
            <Separator />
          </>
        )}

        {/* Core actions group */}
        <Button
          variant="secondary"
          onClick={handleArchive}
          title={ariaLabels.archive}
          aria-label={ariaLabels.archive}
          className={`relative ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
          onMouseEnter={archiveTooltip.tooltipProps.onMouseEnter}
          onMouseLeave={archiveTooltip.tooltipProps.onMouseLeave}
          onFocus={archiveTooltip.tooltipProps.onFocus}
          onBlur={archiveTooltip.tooltipProps.onBlur}
        >
          {archiveTooltip.showTooltip && <TooltipPopup shortcut="E" label="Archive" />}
          <Archive size={isMobile ? 16 : 15} />
        </Button>
        <Button
          variant="secondary"
          onClick={handleDelete}
          title={ariaLabels.delete}
          aria-label={ariaLabels.delete}
          className={`relative ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
          onMouseEnter={trashTooltip.tooltipProps.onMouseEnter}
          onMouseLeave={trashTooltip.tooltipProps.onMouseLeave}
          onFocus={trashTooltip.tooltipProps.onFocus}
          onBlur={trashTooltip.tooltipProps.onBlur}
        >
          {trashTooltip.showTooltip && <TooltipPopup shortcut="T" label="Trash" />}
          <Trash2 size={isMobile ? 16 : 15} />
        </Button>
        <Button
          variant="secondary"
          onClick={handleToggleRead}
          title={ariaLabels.markRead}
          aria-label={ariaLabels.markRead}
          className={`relative ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
          onMouseEnter={markReadTooltip.tooltipProps.onMouseEnter}
          onMouseLeave={markReadTooltip.tooltipProps.onMouseLeave}
          onFocus={markReadTooltip.tooltipProps.onFocus}
          onBlur={markReadTooltip.tooltipProps.onBlur}
        >
          {markReadTooltip.showTooltip && <TooltipPopup shortcut="Q" label={thread.isRead ? "Mark unread" : "Mark read"} />}
          {thread.isRead ? <Mail size={isMobile ? 16 : 15} /> : <MailOpen size={isMobile ? 16 : 15} />}
        </Button>
        <Button
          variant="secondary"
          onClick={handleToggleStar}
          title={ariaLabels.star}
          aria-label={ariaLabels.star}
          className={`relative ${thread.isStarred ? "text-warning" : ""} ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
          onMouseEnter={starTooltip.tooltipProps.onMouseEnter}
          onMouseLeave={starTooltip.tooltipProps.onMouseLeave}
          onFocus={starTooltip.tooltipProps.onFocus}
          onBlur={starTooltip.tooltipProps.onBlur}
        >
          {starTooltip.showTooltip && <TooltipPopup shortcut="S" label={thread.isStarred ? "Unstar" : "Star"} />}
          <Star size={isMobile ? 16 : 15} className={thread.isStarred ? "fill-current" : ""} />
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowSnooze(true)}
          title={ariaLabels.snooze}
          aria-label={ariaLabels.snooze}
          className={`relative ${isMobile ? "p-1.5 min-h-[40px] min-w-[40px]" : "p-2"}`}
          onMouseEnter={snoozeTooltip.tooltipProps.onMouseEnter}
          onMouseLeave={snoozeTooltip.tooltipProps.onMouseLeave}
          onFocus={snoozeTooltip.tooltipProps.onFocus}
          onBlur={snoozeTooltip.tooltipProps.onBlur}
        >
          {snoozeTooltip.showTooltip && <TooltipPopup shortcut="B" label="Snooze" />}
          <Clock size={isMobile ? 16 : 15} />
        </Button>

        {/* Overflow menu trigger — on mobile, always show secondary actions inline */}
        {!isMobile && (
          <div ref={overflowRef} className="relative">
            <Button
              variant="secondary"
              onClick={() => setShowOverflow((prev) => !prev)}
              title="More actions"
              aria-label="More actions"
              aria-expanded={showOverflow}
              className="p-2"
            >
              <MoreHorizontal size={15} />
            </Button>

            {showOverflow && (
              <div className="absolute inset-inline-end-0 top-full mt-1 z-50 bg-bg-primary border border-border-primary rounded-lg shadow-xl py-1 min-w-[200px]">
                {/* Secondary actions group */}
                <Button
                  variant="ghost"
                  onClick={() => { handleSpam(); setShowOverflow(false); }}
                  title={ariaLabels.spam}
                  aria-label={ariaLabels.spam}
                  className="relative w-full justify-start px-3 py-1.5 text-xs"
                  onMouseEnter={spamTooltip.tooltipProps.onMouseEnter}
                  onMouseLeave={spamTooltip.tooltipProps.onMouseLeave}
                  onFocus={spamTooltip.tooltipProps.onFocus}
                  onBlur={spamTooltip.tooltipProps.onBlur}
                >
                  {spamTooltip.showTooltip && <TooltipPopup shortcut="!" label={isSpamView ? "Not spam" : "Report spam"} />}
                  <Ban size={14} className="me-2" />
                  {isSpamView ? 'Not spam' : 'Report spam'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!activeAccountId) return;
                    window.dispatchEvent(new CustomEvent("smemaster-move-to-folder", { detail: { threadIds: [thread.id] } }));
                    setShowOverflow(false);
                  }}
                  title={ariaLabels.moveToFolder}
                  aria-label={ariaLabels.moveToFolder}
                  className="w-full justify-start px-3 py-1.5 text-xs"
                >
                  <FolderInput size={14} className="mr-2" />
                  Move to folder
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { handleTogglePin(); setShowOverflow(false); }}
                  title={ariaLabels.pin}
                  aria-label={ariaLabels.pin}
                  className={`w-full justify-start px-3 py-1.5 text-xs ${thread.isPinned ? "text-accent" : ""}`}
                >
                  <Pin size={14} className={`me-2 ${thread.isPinned ? "fill-current" : ""}`} />
                  {thread.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { handleToggleMute(); setShowOverflow(false); }}
                  title={ariaLabels.mute}
                  aria-label={ariaLabels.mute}
                  className={`w-full justify-start px-3 py-1.5 text-xs ${thread.isMuted ? "text-warning" : ""}`}
                >
                  <VolumeX size={14} className={`me-2 ${thread.isMuted ? "fill-current" : ""}`} />
                  {thread.isMuted ? 'Unmute' : 'Mute'}
                </Button>
                {hasFollowUp ? (
                  <Button
                    variant="ghost"
                    onClick={() => { handleCancelFollowUp(); setShowOverflow(false); }}
                    title={ariaLabels.followUp}
                    aria-label={ariaLabels.followUp}
                    className="w-full justify-start px-3 py-1.5 text-xs text-accent"
                  >
                    <BellRing size={14} className="mr-2 fill-current" />
                    Cancel follow-up
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => { setShowFollowUp(true); setShowOverflow(false); }}
                    title={ariaLabels.followUp}
                    aria-label={ariaLabels.followUp}
                    className="w-full justify-start px-3 py-1.5 text-xs"
                  >
                    <BellRing size={14} className="me-2" />
                    Follow up
                  </Button>
                )}
                {hasUnsubscribe && (
                  <Button
                    variant="ghost"
                    onClick={() => { handleUnsubscribe(); setShowOverflow(false); }}
                    title={ariaLabels.unsubscribe}
                    aria-label={ariaLabels.unsubscribe}
                    className={`w-full justify-start px-3 py-1.5 text-xs ${unsubscribeStatus === "done" ? "text-success" : ""}`}
                  >
                    <MailMinus size={14} className="me-2" />
                    {unsubscribeStatus === "loading" ? 'Unsubscribing…' : unsubscribeStatus === "done" ? 'Unsubscribed' : 'Unsubscribe'}
                  </Button>
                )}

                <div className="my-1 border-t border-border-secondary" role="separator" />

                {/* Utility actions group */}
                <Button
                  variant="ghost"
                  onClick={() => { onPrint?.(); setShowOverflow(false); }}
                  title={ariaLabels.print}
                  aria-label={ariaLabels.print}
                  className="w-full justify-start px-3 py-1.5 text-xs"
                >
                  <Printer size={14} className="mr-2" />
                  Print
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { onExport?.(); setShowOverflow(false); }}
                  title={ariaLabels.export}
                  aria-label={ariaLabels.export}
                  className="w-full justify-start px-3 py-1.5 text-xs"
                >
                  <Download size={14} className="me-2" />
                  Export
                </Button>
                {onPopOut && (
                  <Button
                    variant="ghost"
                    onClick={() => { onPopOut(); setShowOverflow(false); }}
                    title={ariaLabels.popOut}
                    aria-label={ariaLabels.popOut}
                    className="w-full justify-start px-3 py-1.5 text-xs"
                  >
                    <ExternalLink size={14} className="mr-2" />
                    Open in new window
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => { onToggleTaskSidebar?.(); setShowOverflow(false); }}
                  title={ariaLabels.taskSidebar}
                  aria-label={ariaLabels.taskSidebar}
                  className={`w-full justify-start px-3 py-1.5 text-xs ${taskSidebarVisible ? "text-accent" : ""}`}
                >
                  <ListTodo size={14} className="me-2" />
                  {taskSidebarVisible ? 'Hide task panel' : 'Show task panel'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { onToggleContactSidebar?.(); setShowOverflow(false); }}
                  title={ariaLabels.contactSidebar}
                  aria-label={ariaLabels.contactSidebar}
                  className="w-full justify-start px-3 py-1.5 text-xs"
                >
                  {contactSidebarVisible ? <PanelRightClose size={14} className="me-2" /> : <PanelRightOpen size={14} className="me-2" />}
                  {contactSidebarVisible ? 'Hide contact sidebar' : 'Show contact sidebar'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* On mobile, show secondary and utility inline (no overflow) */}
        {isMobile && (
          <>
            <Button
              variant="secondary"
              onClick={handleSpam}
              title={ariaLabels.spam}
              aria-label={ariaLabels.spam}
              className="relative p-1.5 min-h-[40px] min-w-[40px]"
              onMouseEnter={spamTooltip.tooltipProps.onMouseEnter}
              onMouseLeave={spamTooltip.tooltipProps.onMouseLeave}
              onFocus={spamTooltip.tooltipProps.onFocus}
              onBlur={spamTooltip.tooltipProps.onBlur}
            >
              {spamTooltip.showTooltip && <TooltipPopup shortcut="!" label={isSpamView ? "Not spam" : "Report spam"} />}
              <Ban size={16} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!activeAccountId) return;
                window.dispatchEvent(new CustomEvent("smemaster-move-to-folder", { detail: { threadIds: [thread.id] } }));
              }}
              title={ariaLabels.moveToFolder}
              aria-label={ariaLabels.moveToFolder}
              className="p-1.5 min-h-[40px] min-w-[40px]"
            >
              <FolderInput size={16} />
            </Button>
            <Button
              variant="secondary"
              onClick={handleTogglePin}
              title={ariaLabels.pin}
              aria-label={ariaLabels.pin}
              className={`p-1.5 min-h-[40px] min-w-[40px] ${thread.isPinned ? "text-accent" : ""}`}
            >
              <Pin size={16} className={thread.isPinned ? "fill-current" : ""} />
            </Button>
            <Button
              variant="secondary"
              onClick={handleToggleMute}
              title={ariaLabels.mute}
              aria-label={ariaLabels.mute}
              className={`p-1.5 min-h-[40px] min-w-[40px] ${thread.isMuted ? "text-warning" : ""}`}
            >
              <VolumeX size={16} className={thread.isMuted ? "fill-current" : ""} />
            </Button>
            {hasFollowUp ? (
              <Button
                variant="secondary"
                onClick={handleCancelFollowUp}
                title={ariaLabels.followUp}
                aria-label={ariaLabels.followUp}
                className="p-1.5 min-h-[40px] min-w-[40px] text-accent"
              >
                <BellRing size={16} className="fill-current" />
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowFollowUp(true)}
                title={ariaLabels.followUp}
                aria-label={ariaLabels.followUp}
                className="p-1.5 min-h-[40px] min-w-[40px]"
              >
                <BellRing size={16} />
              </Button>
            )}
            {hasUnsubscribe && (
              <Button
                variant="secondary"
                onClick={handleUnsubscribe}
                title={ariaLabels.unsubscribe}
                aria-label={ariaLabels.unsubscribe}
                className={`p-1.5 min-h-[40px] min-w-[40px] ${unsubscribeStatus === "done" ? "text-success" : ""}`}
              >
                <MailMinus size={16} />
              </Button>
            )}
            <div className="ml-auto" />
            <Button variant="secondary" onClick={onPrint} title={ariaLabels.print} aria-label={ariaLabels.print} className="p-1.5 min-h-[40px] min-w-[40px]"><Printer size={16} /></Button>
            <Button variant="secondary" onClick={onExport} title={ariaLabels.export} aria-label={ariaLabels.export} className="p-1.5 min-h-[40px] min-w-[40px]"><Download size={16} /></Button>
            <Button variant="secondary" onClick={onToggleTaskSidebar} title={ariaLabels.taskSidebar} aria-label={ariaLabels.taskSidebar} className={`p-1.5 min-h-[40px] min-w-[40px] ${taskSidebarVisible ? "text-accent" : ""}`}>
              <ListTodo size={16} className={taskSidebarVisible ? "text-accent" : ""} />
            </Button>
            <Button variant="secondary" onClick={onToggleContactSidebar} title={ariaLabels.contactSidebar} aria-label={ariaLabels.contactSidebar} className="p-1.5 min-h-[40px] min-w-[40px]">
              {contactSidebarVisible ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </Button>
          </>
        )}
      </div>

      <SnoozeDialog
        isOpen={showSnooze}
        onSnooze={handleSnooze}
        onClose={() => setShowSnooze(false)}
      />
      <FollowUpDialog
        isOpen={showFollowUp}
        onSetReminder={handleFollowUp}
        onClose={() => setShowFollowUp(false)}
      />
    </>
  );
}
