"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
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

export default function DashboardHeader() {
  const { user } = useAuth();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  /*

Used to detect clicks outside the notification

button + dropdown.
*/
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const name =
    user?.displayName?.trim() || user?.email?.split("@")[0] || "User";

  /* =========================================================
LOAD NOTIFICATIONS
========================================================= */

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoadingNotifications(false);
      setShowNotifications(false);
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
        const items: NotificationItem[] = snapshot.docs.map((item) => {
          const data = item.data();

          let title = "Notification";

          if (data.level === "overspent") {
            title = "Budget exceeded";
          } else if (data.level === "limit") {
            title = "Budget limit reached";
          } else if (data.level === "warning") {
            title = "Budget warning";
          } else if (typeof data.title === "string") {
            title = data.title;
          }

          return {
            id: item.id,
            title,
            message: typeof data.message === "string" ? data.message : "",
            read: data.read === true,
            createdAt: data.createdAt ?? null,
            level:
              data.level === "warning" ||
              data.level === "limit" ||
              data.level === "overspent"
                ? data.level
                : undefined,
          };
        });

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

  /* =========================================================
CLOSE WHEN NAVIGATING
========================================================= */

  useEffect(() => {
    /*
     * pathname changes whenever Next.js navigation occurs.
     *
     * Close the notification dropdown automatically.
     */
    setShowNotifications(false);
  }, [pathname]);

  /* =========================================================
CLOSE WHEN CLICKING OUTSIDE
========================================================= */

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  /* =========================================================
ESCAPE KEY
========================================================= */

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showNotifications]);

  /* =========================================================
UNREAD COUNT
========================================================= */

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  /* =========================================================
NOTIFICATION CLICK
========================================================= */

  async function handleNotificationClick(notification: NotificationItem) {
    /*
     * Close immediately when the notification is clicked.
     */
    setShowNotifications(false);

    /*
     * Already read — nothing else to do.
     */
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
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  }

  /* =========================================================
DATE
========================================================= */

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

  /* =========================================================
NOTIFICATION STYLE
========================================================= */

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

  return (
    <header className="relative flex items-center justify-between gap-4">
      {/* =====================================================
HEADER TEXT
====================================================== */}

      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500">Good day</p>

        <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
          {name}
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Here's your financial overview.
        </p>
      </div>

      {/* =====================================================
      NOTIFICATION
  ====================================================== */}

      <div ref={notificationRef} className="relative shrink-0">
        {/* BELL */}

        <button
          type="button"
          aria-label="Notifications"
          aria-expanded={showNotifications}
          onClick={() => setShowNotifications((current) => !current)}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition ${
            showNotifications ? "bg-gray-100" : "hover:bg-gray-50"
          }`}
        >
          <span className="text-lg">🔔</span>

          {/* UNREAD BADGE */}

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f5f7]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* =================================================
        DROPDOWN
    ================================================== */}

        {showNotifications && (
          <div className="absolute right-0 top-14 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            {/* HEADER */}

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

            {/* NOTIFICATIONS */}

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
                notifications.map((notification) => {
                  const style = getNotificationStyle(notification);

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${style.container}`}
                    >
                      <div className="flex gap-3">
                        {/* DOT */}

                        <div className="pt-1.5">
                          <span
                            className={`block h-2.5 w-2.5 rounded-full ${style.dot}`}
                          />
                        </div>

                        {/* CONTENT */}

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
                })
              )}
            </div>

            {/* FOOTER */}

            {notifications.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                <p className="text-xs text-gray-400">
                  Showing your 5 most recent notifications
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
