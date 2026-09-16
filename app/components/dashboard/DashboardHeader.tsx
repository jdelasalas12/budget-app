"use client";

import { useEffect, useState } from "react";
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

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const name =
    user?.displayName?.trim() || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);

    /*
     * IMPORTANT
     *
     * Budget notifications are stored here:
     *
     * users/{userId}/notifications/{notificationId}
     *
     * This must match subscribeToBudgetNotifications().
     */
    const notificationsRef = collection(db, "users", user.uid, "notifications");

    /*
     * Load the newest 5 notifications.
     *
     * Unread notifications stay highlighted.
     * Reading a notification only changes read=true.
     * It does NOT remove the notification from the list.
     */
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

          /*
           * Give budget notifications useful titles.
           */
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

  /*
   * Only unread notifications affect the red badge.
   */
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  async function handleNotificationClick(notification: NotificationItem) {
    if (!user || notification.read) {
      return;
    }

    try {
      /*
       * IMPORTANT
       *
       * Update the same document that the notification
       * listener is reading:
       *
       * users/{userId}/notifications/{notificationId}
       */
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

      /*
       * onSnapshot will automatically update the UI.
       *
       * The notification remains visible but is no longer
       * highlighted.
       */
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  }

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
      <div>
        <p className="text-sm font-medium text-gray-500">Good day</p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
          {name}
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Here's your financial overview.
        </p>
      </div>

      {/* Notification button + dropdown */}
      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          aria-expanded={showNotifications}
          onClick={() => setShowNotifications((current) => !current)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50"
        >
          <span className="text-lg">🔔</span>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f5f7]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-14 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            {/* Header */}
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

            {/* Notifications */}
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
                        {/* Unread indicator */}
                        <div className="pt-1.5">
                          <span
                            className={`block h-2.5 w-2.5 rounded-full ${style.dot}`}
                          />
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
                })
              )}
            </div>

            {/* Footer */}
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
