async function parseApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON response from server" };
    }
  }

  return { error: raw || `Non-JSON response (${res.status})` };
}

export async function fetchUsers() {
  const res = await fetch("/api/users", {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to load users");
  }

  return data.users || [];
}

export async function createUser(user: any) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to create user");
  }

  return data;
}

export async function updateUser(email: string, user: any) {
  const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to update user");
  }

  return data;
}