export type AdminIdentity = { username: string; displayName: string };

const DEFAULT_NAMES = ["Adrián Quintero", "Miguel Gómez", "Darío Pérez"];

function configuredAccounts() {
  return [1, 2, 3].flatMap((slot) => {
    const username = process.env[`ADMIN_USER_${slot}`];
    const password = process.env[`ADMIN_PASSWORD_${slot}`];
    if (!username || !password) return [];
    return [{
      username,
      password,
      displayName: process.env[`ADMIN_NAME_${slot}`] || DEFAULT_NAMES[slot - 1],
    }];
  });
}

export function authenticateAdmin(username: string, password: string): AdminIdentity | null {
  // El usuario no distingue mayúsculas ni espacios ("adrian" = "ADRIAN"); la contraseña sí, exacta.
  const u = username.trim().toLowerCase();
  const account = configuredAccounts().find((entry) => entry.username.trim().toLowerCase() === u && entry.password === password);
  return account ? { username: account.username, displayName: account.displayName } : null;
}

export function getAdminIdentity(username: string): AdminIdentity | null {
  const account = configuredAccounts().find((entry) => entry.username.trim().toLowerCase() === username.trim().toLowerCase());
  return account ? { username: account.username, displayName: account.displayName } : null;
}

export function getConfiguredAdmins(): AdminIdentity[] {
  return configuredAccounts().map(({ username, displayName }) => ({ username, displayName }));
}
