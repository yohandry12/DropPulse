import { httpClient } from "./httpClient";

// Mirrors GET /notifications (backend/src/notifications/routes.ts).
export type NotificationType =
  | "DROP_OPEN"
  | "DROP_SOON"
  | "PAYMENT_CONFIRMED"
  | "HOLD_EXPIRING";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  productId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  unread: number;
  items: AppNotification[];
}

export async function getNotifications(): Promise<NotificationFeed> {
  const res = await httpClient.get<NotificationFeed>("/notifications");
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await httpClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await httpClient.post("/notifications/read-all");
}

// "M'alerter à l'ouverture" — subscription to an upcoming drop's opening.
export async function getDropAlert(productId: string): Promise<boolean> {
  const res = await httpClient.get<{ subscribed: boolean }>(`/products/${productId}/alert`);
  return res.data.subscribed;
}

export async function subscribeDropAlert(productId: string): Promise<void> {
  await httpClient.post(`/products/${productId}/alert`);
}

export async function unsubscribeDropAlert(productId: string): Promise<void> {
  await httpClient.delete(`/products/${productId}/alert`);
}
