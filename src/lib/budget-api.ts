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

export async function fetchBudgetItems() {
  const res = await fetch("/api/budget-items", {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to load budget items");
  }

  return data.items || [];
}

export async function createBudgetItem(item: any) {
  const res = await fetch("/api/budget-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || `Failed to create item (${res.status})`);
  }

  return data;
}

export async function updateBudgetItem(id: string, item: any) {
  const res = await fetch(`/api/budget-items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || `Failed to update item (${res.status})`);
  }

  return data;
}

export async function deleteBudgetItem(id: string) {
  const res = await fetch(`/api/budget-items/${id}`, {
    method: "DELETE",
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || `Failed to delete item (${res.status})`);
  }

  return data;
}
export async function bulkDeleteBudgetItems(ids: string[]) {
  const res = await fetch("/api/budget-items/bulk-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  const data = await parseApiResponse(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to bulk delete items");
  }

  return data;
}