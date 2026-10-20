import mysql from "mysql2/promise";

export type StaffNotification = {
  id: number;
  message: string;
  time: string;
  actor: string;
};

async function connect() {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  if (!host || !database || !user) return null;
  return mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    database,
    user,
    password: process.env.DB_PASS ?? "",
  });
}

async function ensureTable(connection: mysql.Connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS project_staff_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      recipient VARCHAR(120) NOT NULL,
      actor VARCHAR(120) NOT NULL,
      message VARCHAR(500) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_recipient (recipient)
    )`,
  );
}

export async function saveStaffNotification(input: {
  recipient: string;
  actor: string;
  message: string;
}) {
  const recipient = input.recipient.trim();
  const actor = input.actor.trim();
  if (!recipient || !actor || recipient.toLowerCase() === actor.toLowerCase()) return;
  const connection = await connect();
  if (!connection) return;
  try {
    await ensureTable(connection);
    await connection.query(
      `INSERT INTO project_staff_notifications (recipient, actor, message) VALUES (?, ?, ?)`,
      [recipient, actor, input.message.slice(0, 500)],
    );
  } finally {
    await connection.end();
  }
}

export async function listStaffNotifications(recipient: string): Promise<StaffNotification[]> {
  const name = recipient.trim();
  if (!name) return [];
  const connection = await connect();
  if (!connection) return [];
  try {
    await ensureTable(connection);
    const [rows] = await connection.query(
      `SELECT id, actor, message, created_at
       FROM project_staff_notifications
       WHERE recipient = ? AND LOWER(actor) <> LOWER(?)
       ORDER BY id DESC
       LIMIT 50`,
      [name, name],
    );
    return (rows as { id: number; actor: string; message: string; created_at: Date | string }[]).map(
      (row) => ({
        id: Number(row.id),
        actor: row.actor,
        message: row.message,
        time: new Date(row.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      }),
    );
  } finally {
    await connection.end();
  }
}
