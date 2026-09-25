"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { db } from "@/lib/firebase";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | null;
  level?: "warning" | "limit" | "overspent";
}

const NOTIFICATIONS_PER_PAGE = 10;

function mapNotification(
  item: DocumentSnapshot<DocumentData>,
): NotificationItem {
  const data = item.data();

  let title = "Notification";

  if (data?.level === "overspent") {
    title = "Budget exceeded";
  } else if (data?.level === "limit") {
    title = "Budget limit reached";
  } else if (data?.level === "warning") {
    title = "Budget warning";
  } else if (typeof data?.title === "string") {
    title = data.title;
  }

  const createdAt =
    data?.createdAt && typeof data.createdAt.toDate === "function"
      ? (data.createdAt as Timestamp)
      : null;

  return {
    id: item.id,
    title,
    message: typeof data?.message === "string" ? data.message : "",
    read: data?.read === true,
    createdAt,
    level:
      data?.level === "warning" ||
      data?.level === "limit" ||
      data?.level === "overspent"
        ? data.level
        : undefined,
  };
}

export default function DashboardHeader() {
  const { user } = useAuth();

  // Latest 5 notifications for dropdown
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Full notification page
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(
    [],
  );

  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingAllNotifications, setLoadingAllNotifications] = useState(false);

  const [page, setPage] = useState(1);

  // Cursor for the beginning of the current page
  const [pageCursors, setPageCursors] = useState<
    Array<DocumentSnapshot<DocumentData> | null>
  >([null]);

  // Whether another page exists
  const [hasNextPage, setHasNextPage] = useState(false);

  const name =
    user?.displayName?.trim() || user?.email?.split("@")[0] || "User";

  /*
   * ============================================================
   * LATEST 5 NOTIFICATIONS
   * ============================================================
   */

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);

    const notificationsRef = collection(db, "users", user.uid, "notifications");

    const notificationsQuery = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(5),
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items = snapshot.docs.map(mapNotification);

        setNotifications(items);
        setLoadingNotifications(false);
      },
      (error) => {
        console.error("Unable to load notifications:", error);

        setNotifications([]);
        setLoadingNotifications(false);
      },
    );

    return unsubscribe;
  }, [user]);

  /*
   * ============================================================
   * UNREAD COUNT
   * ============================================================
   *
   * This counts unread notifications among the latest 5.
   *
   * If you want the badge to represent ALL unread notifications,
   * we can add a separate Firestore count query later.
   */

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  /*
   * ============================================================
   * LOAD FULL NOTIFICATION PAGE
   * ============================================================
   */

  async function loadNotificationPage(
    requestedPage: number,
    cursor: DocumentSnapshot<DocumentData> | null = null,
  ) {
    if (!user) {
      return;
    }

    setLoadingAllNotifications(true);

    try {
      const notificationsRef = collection(
        db,
        "users",
        user.uid,
        "notifications",
      );

      const baseQuery = query(
        notificationsRef,
        orderBy("createdAt", "desc"),
        limit(NOTIFICATIONS_PER_PAGE + 1),
      );

      /*
       * If we're moving forward, start after the
       * last document from the previous page.
       */
      const paginatedQuery = cursor
        ? query(
            notificationsRef,
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(NOTIFICATIONS_PER_PAGE + 1),
          )
        : baseQuery;

      const snapshot = await getDocs(paginatedQuery);

      /*
       * Get one extra document.
       *
       * Example:
       * 10 requested
       * 11 returned
       *
       * The 11th tells us that another page exists.
       */
      const hasMore = snapshot.docs.length > NOTIFICATIONS_PER_PAGE;

      const pageDocs = hasMore
        ? snapshot.docs.slice(0, NOTIFICATIONS_PER_PAGE)
        : snapshot.docs;

      const items = pageDocs.map(mapNotification);

      setAllNotifications(items);
      setHasNextPage(hasMore);
      setPage(requestedPage);

      /*
       * Store the last document of this page.
       *
       * It becomes the cursor for the next page.
       */
      if (pageDocs.length > 0) {
        setPageCursors((current) => {
          const updated = [...current];
          updated[requestedPage] = pageDocs[pageDocs.length - 1];
          return updated;
        });
      }
    } catch (error) {
      console.error("Unable to load notification page:", error);
      setAllNotifications([]);
      setHasNextPage(false);
    } finally {
      setLoadingAllNotifications(false);
    }
  }

  /*
   * ============================================================
   * OPEN "VIEW ALL"
   * ============================================================
   */

  async function openAllNotifications() {
    setShowNotifications(false);
    setShowAllNotifications(true);

    setPage(1);
    setPageCursors([null]);

    await loadNotificationPage(1, null);
  }

  /*
   * ============================================================
   * NEXT PAGE
   * ============================================================
   */

  async function nextNotificationPage() {
    const cursor = pageCursors[page];

    if (!cursor || loadingAllNotifications) {
      return;
    }

    await loadNotificationPage(page + 1, cursor);
  }

  /*
   * ============================================================
   * PREVIOUS PAGE
   * ============================================================
   */

  async function previousNotificationPage() {
    if (page <= 1 || loadingAllNotifications) {
      return;
    }

    /*
     * To go back to page N, we need the cursor for
     * the page before N.
     *
     * Page 2 uses cursor from page 1.
     * Page 3 uses cursor from page 2.
     */
    const previousPage = page - 1;

    if (previousPage === 1) {
      await loadNotificationPage(1, null);
      return;
    }

    const cursor = pageCursors[previousPage - 1];

    await loadNotificationPage(previousPage, cursor);
  }

  /*
   * ============================================================
   * MARK NOTIFICATION AS READ
   * ============================================================
   */

  async function handleNotificationClick(notification: NotificationItem) {
    if (!user || notification.read) {
      return;
    }

    try {
      const notificationRef = doc(
        db,
        "users",
        user.uid,
        "notifications",
        notification.id,
      );

      await updateDoc(notificationRef, {
        read: true,
        updatedAt: serverTimestamp(),
      });

      /*
       * Update the dropdown immediately.
       */
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );

      /*
       * Update the full notification list immediately.
       */
      setAllNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  }

  /*
   * ============================================================
   * DATE FORMAT
   * ============================================================
   */

  function formatNotificationDate(timestamp: Timestamp | null) {
    if (!timestamp) {
      return "";
    }

    const date = timestamp.toDate();

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  /*
   * ============================================================
   * NOTIFICATION COLORS
   * ============================================================
   */

  function getNotificationStyle(notification: NotificationItem) {
    if (notification.read) {
      return {
        container: "bg-white",
        dot: "bg-gray-200",
      };
    }

    if (notification.level === "overspent") {
      return {
        container: "bg-red-50",
        dot: "bg-red-500",
      };
    }

    if (notification.level === "limit") {
      return {
        container: "bg-amber-50",
        dot: "bg-amber-500",
      };
    }

    return {
      container: "bg-blue-50/70",
      dot: "bg-blue-500",
    };
  }

  /*
   * ============================================================
   * NOTIFICATION ITEM
   * ============================================================
   */

  function NotificationRow({
    notification,
  }: {
    notification: NotificationItem;
  }) {
    const style = getNotificationStyle(notification);

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => handleNotificationClick(notification)}
        className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${style.container}`}
      >
        <div className="flex gap-3">
          <div className="pt-1.5">
            <span className={`block h-2.5 w-2.5 rounded-full ${style.dot}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-sm ${
                  notification.read
                    ? "font-medium text-gray-700"
                    : "font-bold text-gray-950"
                }`}
              >
                {notification.title}
              </p>

              {!notification.read && (
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                  New
                </span>
              )}
            </div>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              {notification.message}
            </p>

            {notification.createdAt && (
              <p className="mt-1.5 text-[10px] text-gray-400">
                {formatNotificationDate(notification.createdAt)}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      <header className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Good day</p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
            {name}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Here's your financial overview.
          </p>
        </div>

        {/* =====================================================
            NOTIFICATION BUTTON
            ===================================================== */}

        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-haspopup="menu"
            onClick={() => setShowNotifications((current) => !current)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50"
          >
            <span className="text-lg">🔔</span>

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f5f7]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* =================================================
              DROPDOWN
              ================================================= */}

          {showNotifications && (
            <div className="absolute right-0 top-14 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Notifications
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-400">
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "You're all caught up"}
                  </p>
                </div>

                <span className="text-xs text-gray-400">Latest 5</span>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {loadingNotifications ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <div className="text-2xl">🔔</div>

                    <p className="mt-2 text-sm font-medium text-gray-700">
                      No notifications
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      You're all caught up.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                    />
                  ))
                )}
              </div>

              {/* View all */}
              <div className="border-t border-gray-100 p-2">
                <button
                  type="button"
                  onClick={openAllNotifications}
                  className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =======================================================
          FULL NOTIFICATIONS MODAL
          ======================================================= */}

      {showAllNotifications && (
        <div className="fixed inset-0 z-[100] bg-black/30 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  All Notifications
                </h2>

                <p className="mt-0.5 text-xs text-gray-400">Page {page}</p>
              </div>

              <button
                type="button"
                aria-label="Close notifications"
                onClick={() => setShowAllNotifications(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            {/* Notification list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingAllNotifications ? (
                <div className="flex min-h-[300px] items-center justify-center px-4 text-sm text-gray-500">
                  Loading notifications...
                </div>
              ) : allNotifications.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
                  <div className="text-3xl">🔔</div>

                  <p className="mt-3 text-sm font-semibold text-gray-700">
                    No notifications
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    You're all caught up.
                  </p>
                </div>
              ) : (
                allNotifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                disabled={page <= 1 || loadingAllNotifications}
                onClick={previousNotificationPage}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>

              <span className="text-xs font-medium text-gray-400">
                Page {page}
              </span>

              <button
                type="button"
                disabled={!hasNextPage || loadingAllNotifications}
                onClick={nextNotificationPage}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
