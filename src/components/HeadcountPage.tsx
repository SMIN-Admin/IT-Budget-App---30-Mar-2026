"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type HeadcountRecord = {
  id?: string;
  userEmailId: string;
  businessUnit: string;
  location: string;
  department: string;
  empType: string;
  fyHalf: string;
  createdAt?: string;
  updatedAt?: string;
  uploadedBy?: string;
};

type HeadcountPageProps = {
  user?: { email?: string; role?: string };
  records?: HeadcountRecord[];
  onChangeRecords?: React.Dispatch<React.SetStateAction<HeadcountRecord[]>>;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  summaryRows?: any[];
  onReloadSummary?: () => Promise<void>;
  onReloadRecords?: () => Promise<void>;
};

const EMP_TYPES = ["Permanent", "Contract", "Intern", "Consultant"];

function normalize(value: unknown) {
  return String(value ?? "").trim();
}
function getUniqueSorted(values: Array<string | undefined | null>) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort();
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((v) => v.trim());
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? "";
    });
    return row;
  });
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  minWidth = 180,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const allSelected = selected.includes("all") || selected.length === 0;

  const display = allSelected
    ? label
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  const toggle = (value: string) => {
    if (value === "all") {
      onChange(["all"]);
      return;
    }
    const current = allSelected ? [] : selected;
    const exists = current.includes(value);
    const next = exists ? current.filter((x) => x !== value) : [...current, value].sort();
    onChange(next.length ? next : ["all"]);
  };

  return (
    <div ref={ref} style={{ position: "relative", minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "#09131D",
          border: "1px solid #213547",
          borderRadius: 10,
          color: "#f1f5f9",
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{display}</span>
        <span style={{ color: "#9fb3c8", marginLeft: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 50,
            width: 280,
            maxHeight: 280,
            overflowY: "auto",
            background: "#09131D",
            border: "1px solid #213547",
            borderRadius: 12,
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            padding: 8,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              cursor: "pointer",
              color: "#E0E7FF",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <input type="checkbox" checked={allSelected} onChange={() => toggle("all")} />
            <span>{label}</span>
          </label>

          <div style={{ height: 1, background: "#213547", margin: "6px 4px" }} />

          {options.map((option) => (
            <label
              key={option}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                color: "#E0E7FF",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={!allSelected && selected.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadcountImportModal({
  open,
  onClose,
  onImport,
  templateCsv,
  canImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: HeadcountRecord[]) => void;
  templateCsv: string;
  canImport: boolean;
}) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<HeadcountRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
  setCsvText("");
  setFileName("");
  setIsImporting(false);
  setPreviewRows([]);
  setErrors([]);
}
  }, [open]);

  if (!open) return null;

  const validateAndPreview = (text: string) => {
    setCsvText(text);
    const rows = parseCsv(text);

    if (!rows.length) {
      setPreviewRows([]);
      setErrors(["No valid CSV rows found."]);
      return;
    }

    const parsed: HeadcountRecord[] = [];
    const nextErrors: string[] = [];
    const keySet = new Set<string>();

    rows.forEach((row, index) => {
      const record: HeadcountRecord = {
        userEmailId: normalize(row.userEmailId),
        businessUnit: normalize(row.businessUnit),
        location: normalize(row.location),
        department: normalize(row.department),
        empType: normalize(row.empType),
        fyHalf: normalize(row.fyHalf),
      };

      const rowNo = index + 2;
      if (!record.userEmailId || !record.userEmailId.includes("@")) {
        nextErrors.push(`Row ${rowNo}: userEmailId is required and must be a valid email.`);
      }
      if (!record.businessUnit) nextErrors.push(`Row ${rowNo}: businessUnit is required.`);
      if (!record.location) nextErrors.push(`Row ${rowNo}: location is required.`);
      if (!record.department) nextErrors.push(`Row ${rowNo}: department is required.`);
      if (!record.empType) nextErrors.push(`Row ${rowNo}: empType is required.`);
      if (record.empType && !EMP_TYPES.includes(record.empType)) {
        nextErrors.push(`Row ${rowNo}: empType must be one of ${EMP_TYPES.join(", ")}.`);
      }
      if (!record.fyHalf || !/^\d{4}-H[12]$/.test(record.fyHalf)) {
        nextErrors.push(`Row ${rowNo}: fyHalf must be in format YYYY-H1 or YYYY-H2.`);
      }

      const dupKey = `${record.userEmailId.toLowerCase()}__${record.fyHalf}`;
      if (keySet.has(dupKey)) {
        nextErrors.push(`Row ${rowNo}: same user email is repeated within the same FY/Half in the import file.`);
      } else {
        keySet.add(dupKey);
      }

      parsed.push(record);
    });

    setPreviewRows(parsed.slice(0, 8));
    setErrors(nextErrors);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000c9",
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          maxHeight: "88vh",
overflowY: "auto",
          background: "#0F1B2B",
          border: "1px solid rgba(94,234,212,0.15)",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 12px 44px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#E6FFFD", fontSize: 18, fontWeight: 800 }}>📥 Import Headcount</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              Download the template first, then paste CSV content here or connect it to your uploader later.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(148,163,184,0.25)",
              borderRadius: 8,
              color: "#cbd5e1",
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {!canImport ? (
          <div style={{ color: "#fca5a5", fontSize: 13 }}>You do not have access to import headcount.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => downloadTextFile("headcount_template.csv", templateCsv, "text/csv;charset=utf-8")}
                style={{
                  background: "rgba(94,234,212,0.1)",
                  border: "1px solid rgba(94,234,212,0.28)",
                  borderRadius: 10,
                  color: "#D2FFFB",
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                ⬇ Download CSV Template
              </button>
            </div>

            <label
  style={{
    background: "rgba(124,140,255,0.08)",
    border: "1px solid rgba(124,140,255,0.30)",
    borderRadius: 10,
    color: "#E0E7FF",
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  }}
>
  📂 Upload CSV File
  <input
    type="file"
    accept=".csv,text/csv"
    style={{ display: "none" }}
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      try {
        const text = await file.text();
        validateAndPreview(text);
      } catch (err) {
        setErrors(["Failed to read selected CSV file."]);
        setPreviewRows([]);
      }
    }}
  />
</label>

            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <div style={{ color: "#E6FFFD", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Template and data rules
              </div>
              <ul style={{ paddingLeft: 18, color: "#94a3b8", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                <li>Columns: userEmailId, businessUnit, location, department, empType, fyHalf</li>
                <li>fyHalf format: 2026-H1 or 2026-H2</li>
                <li>empType allowed values: {EMP_TYPES.join(", ")}</li>
                <li>Same user email is allowed in different FY/Halves, but must not repeat within the same FY/Half</li>
              </ul>
            </div>

            {fileName && (
  <div style={{ color: "#93C5FD", fontSize: 12, marginBottom: 8 }}>
    Selected file: <span style={{ fontWeight: 700 }}>{fileName}</span>
  </div>
)}

            <textarea
              value={csvText}
              onChange={(e) => validateAndPreview(e.target.value)}
              placeholder={templateCsv}
              style={{
                width: "100%",
                minHeight: 180,
                borderRadius: 12,
                border: "1px solid #213547",
                background: "#09131D",
                color: "#E6FFFD",
                padding: 14,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                resize: "vertical",
                marginBottom: 14,
              }}
            />

            {errors.length > 0 && (
              <div
                style={{
                  background: "rgba(127,29,29,0.35)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ color: "#fecaca", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Import validation issues
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#fecaca", fontSize: 12, lineHeight: 1.6 }}>
                  {errors.slice(0, 10).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {previewRows.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#E6FFFD", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Preview
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {["User Email ID", "Business Unit", "Location", "Department", "Emp. Type", "FY & Half"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              color: "#8B9BB4",
                              borderBottom: "1px solid #1f3142",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={`${row.userEmailId}-${row.fyHalf}-${idx}`}>
                          <td style={{ padding: "8px 10px", color: "#E5EEF8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.userEmailId}</td>
                          <td style={{ padding: "8px 10px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.businessUnit}</td>
                          <td style={{ padding: "8px 10px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.location}</td>
                          <td style={{ padding: "8px 10px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.department}</td>
                          <td style={{ padding: "8px 10px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.empType}</td>
                          <td style={{ padding: "8px 10px", color: "#7dd3fc", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.fyHalf}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
    position: "sticky",
    bottom: 0,
    background: "#0F1B2B",
    paddingTop: 12,
  }}
>
              <button
                onClick={onClose}
                style={{
                  background: "#213547",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 10,
                  color: "#f1f5f9",
                  padding: "9px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                disabled={isImporting || errors.length > 0 || parseCsv(csvText).length === 0}
                onClick={async () => {
  if (errors.length > 0 || isImporting) return;

  const rows = parseCsv(csvText).map((row) => ({
    userEmailId: normalize(row.userEmailId),
    businessUnit: normalize(row.businessUnit),
    location: normalize(row.location),
    department: normalize(row.department),
    empType: normalize(row.empType),
    fyHalf: normalize(row.fyHalf),
  }));

  try {
  setIsImporting(true);
  setErrors([]);
  await onImport(rows);
  onClose();
} catch (error: any) {
  setErrors([error?.message || "Failed to import headcount rows."]);
} finally {
  setIsImporting(false);
}
}}
                style={{
                  background:
  isImporting || errors.length > 0 || parseCsv(csvText).length === 0
    ? "#334155"
    : "linear-gradient(135deg,#22D3EE,#2DD4BF)",
                  border: "none",
                  borderRadius: 10,
                  color: "#04121a",
                  padding: "9px 18px",
                  cursor:
  isImporting || errors.length > 0 || parseCsv(csvText).length === 0
    ? "not-allowed"
    : "pointer",
    opacity: isImporting ? 0.75 : 1,
                  fontWeight: 800,
                }}
              >
                {isImporting ? "Importing..." : "Import Rows"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function HeadcountPage({
  user,
  records = [],
  onChangeRecords,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  summaryRows = [],
  onReloadSummary,
  onReloadRecords,
}: HeadcountPageProps) {
  const role = user?.role || "viewer";
  const currentUserEmail = user?.email || "Unknown";
  const canImport = role === "admin" || role === "budget_collaborator";
  const canDelete = role === "admin" || role === "budget_collaborator";
  const canExport = ["admin", "budget_collaborator", "viewer", "approver"].includes(role);

  const [search, setSearch] = useState("");
  const [selectedFYs, setSelectedFYs] = useState<string[]>(["all"]);
  const [selectedBUs, setSelectedBUs] = useState<string[]>(["all"]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["all"]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["all"]);
  const [selectedEmpTypes, setSelectedEmpTypes] = useState<string[]>(["all"]);

  const [sortKey, setSortKey] = useState<keyof HeadcountRecord>("fyHalf");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
const pageSize = 100;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<HeadcountRecord>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const templateCsv = `userEmailId,businessUnit,location,department,empType,fyHalf
john.doe@company.com,WP-India,Bangalore,IT,Permanent,2026-H1
jane.smith@company.com,WP-Singapore,Singapore,Finance,Contract,2026-H1`;

  const fyOptions = useMemo(() => getUniqueSorted(records.map((r) => r.fyHalf)), [records]);
  const editFyOptions = fyOptions.length ? fyOptions : getUniqueSorted(summaryRows.map((r: any) => r.fyHalf));
  const buOptions = useMemo(() => getUniqueSorted(records.map((r) => r.businessUnit)), [records]);
  const locationOptions = useMemo(() => getUniqueSorted(records.map((r) => r.location)), [records]);
  const departmentOptions = useMemo(() => getUniqueSorted(records.map((r) => r.department)), [records]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((row) => {
        const fyMatch = selectedFYs.includes("all") || selectedFYs.includes(row.fyHalf);
        const buMatch = selectedBUs.includes("all") || selectedBUs.includes(row.businessUnit);
        const locationMatch = selectedLocations.includes("all") || selectedLocations.includes(row.location);
        const departmentMatch = selectedDepartments.includes("all") || selectedDepartments.includes(row.department);
        const empTypeMatch = selectedEmpTypes.includes("all") || selectedEmpTypes.includes(row.empType);

        const searchMatch =
          !query ||
          row.userEmailId.toLowerCase().includes(query) ||
          row.businessUnit.toLowerCase().includes(query) ||
          row.location.toLowerCase().includes(query) ||
          row.department.toLowerCase().includes(query);

        return fyMatch && buMatch && locationMatch && departmentMatch && empTypeMatch && searchMatch;
      })
      .sort((a, b) => {
        const aVal = String(a[sortKey] ?? "");
        const bVal = String(b[sortKey] ?? "");
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [records, search, selectedFYs, selectedBUs, selectedLocations, selectedDepartments, selectedEmpTypes, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

const pagedRows = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filtered.slice(start, start + pageSize);
}, [filtered, currentPage]);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(1);
  }
}, [currentPage, totalPages]);
useEffect(() => {
  setCurrentPage(1);
}, [
  search,
  sortKey,
  sortDir,
  selectedFYs.join("|"),
  selectedBUs.join("|"),
  selectedLocations.join("|"),
  selectedDepartments.join("|"),
  selectedEmpTypes.join("|"),
]);

  const selectedCount = selectedIds.size;
  const allFilteredIds = filtered.map((r) => r.id || `${r.userEmailId}__${r.fyHalf}`);
  const allSelected = filtered.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const filteredSummaryRows = useMemo(() => {
  return summaryRows.filter((row: any) => {
    const fyMatch =
      selectedFYs.includes("all") ||
      selectedFYs.includes(String(row.fyHalf || "").trim());

    const buMatch =
      selectedBUs.includes("all") ||
      selectedBUs.includes(String(row.businessUnit || "").trim());

    const locationMatch =
      selectedLocations.includes("all") ||
      selectedLocations.includes(String(row.location || "").trim());

    const departmentMatch =
      selectedDepartments.includes("all") ||
      selectedDepartments.includes(String(row.department || "").trim());

    const empTypeMatch =
      selectedEmpTypes.includes("all") ||
      selectedEmpTypes.includes(String(row.empType || "").trim());

    return fyMatch && buMatch && locationMatch && departmentMatch && empTypeMatch;
  });
}, [
  summaryRows,
  selectedFYs,
  selectedBUs,
  selectedLocations,
  selectedDepartments,
  selectedEmpTypes,
]);

const totalHeadcount = filteredSummaryRows.reduce(
  (sum: number, row: any) => sum + Number(row.headcount || 0),
  0
);

const totalBUsInScope = getUniqueSorted(
  filteredSummaryRows.map((r: any) => String(r.businessUnit || "").trim())
).length;

const totalLocationsInScope = getUniqueSorted(
  filteredSummaryRows.map((r: any) => String(r.location || "").trim())
).length;

const totalDepartmentsInScope = getUniqueSorted(
  filteredSummaryRows.map((r: any) => String(r.department || "").trim())
).length;

const selectedHalfCount = getUniqueSorted(
  filteredSummaryRows.map((r: any) => String(r.fyHalf || "").trim())
).length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(allFilteredIds));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (key: keyof HeadcountRecord) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const handleImport = async (rows: HeadcountRecord[]) => {
  try {
    const res = await fetch("/api/headcount", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to import headcount rows");
    }

    const reloadRes = await fetch("/api/headcount", {
  method: "GET",
  cache: "no-store",
});

const reloadData = await reloadRes.json();

if (!reloadRes.ok) {
  throw new Error(reloadData?.error || "Failed to reload headcount records after import");
}

onChangeRecords?.(Array.isArray(reloadData?.items) ? reloadData.items : []);

alert(`Headcount import successful. ${data?.receivedCount || rows.length} row(s) added.`);
  } catch (error: any) {
    console.error("Headcount import failed:", error);
    alert(error?.message || "Failed to import headcount rows.");
  }
};

const handleSaveEdit = async (rowId: string) => {
  try {
    setIsSavingEdit(true);
    setEditError("");

    const businessUnit = String(editDraft.businessUnit || "").trim();
const location = String(editDraft.location || "").trim();
const department = String(editDraft.department || "").trim();
const empType = String(editDraft.empType || "").trim();
const fyHalf = String(editDraft.fyHalf || "").trim();
  
if (!businessUnit) {
  setEditError("Business Unit is required.");
  setIsSavingEdit(false);
  return;
}

if (!location) {
  setEditError("Location is required.");
  setIsSavingEdit(false);
  return;
}

if (!department) {
  setEditError("Department is required.");
  setIsSavingEdit(false);
  return;
}

if (!empType) {
  setEditError("Emp. Type is required.");
  setIsSavingEdit(false);
  return;
}

if (!/^\d{4}-H[12]$/.test(fyHalf)) {
  setEditError("FY & Half must be in format YYYY-H1 or YYYY-H2.");
  setIsSavingEdit(false);
  return;
}

    const res = await fetch("/api/headcount/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  id: rowId,
  businessUnit,
  location,
  department,
  empType,
  fyHalf,
}),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update headcount row");
    }
    const rebuildRes = await fetch("/api/headcount-summary/rebuild", {
  method: "POST",
});

const rebuildData = await rebuildRes.json();

if (!rebuildRes.ok) {
  throw new Error(rebuildData?.error || "Failed to rebuild headcount summary after update");
}
    await onReloadRecords?.();
    await onReloadSummary?.();
    setEditingRowId(null);
    setEditDraft({});


    alert("Headcount row updated successfully.");
  } catch (error: any) {
    console.error("Headcount row update failed:", error);
    setEditError(error?.message || "Failed to update headcount row.");
  } finally {
    setIsSavingEdit(false);
  }
};

  const handleExport = () => {
    const headers = ["userEmailId", "businessUnit", "location", "department", "empType", "fyHalf", "uploadedBy"];
    const rows = filtered.map((row) =>
      headers.map((header) => csvEscape((row as any)[header])).join(",")
    );
    downloadTextFile(
      "headcount_export.csv",
      `${headers.join(",")}\n${rows.join("\n")}`,
      "text/csv;charset=utf-8"
    );
  };

  const handleDeleteSelected = () => {
    if (!canDelete || selectedIds.size === 0) return;
    const ok = window.confirm(`Delete ${selectedIds.size} selected headcount row(s)? This cannot be undone.`);
    if (!ok) return;
    onChangeRecords?.((prev) =>
  prev.filter((row) => !selectedIds.has(row.id || `${row.userEmailId}__${row.fyHalf}`))
);
    setSelectedIds(new Set());
  };

  const kpiCard = (label: string, value: string | number, color: string) => (
    <div
      style={{
        background: "linear-gradient(145deg,#0B1624,#0A1320)",
        borderRadius: 12,
        padding: 18,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ color: "#88A0B8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <HeadcountImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        templateCsv={templateCsv}
        canImport={canImport}
      />

      <div
        style={{
          background: "linear-gradient(135deg,#0C1722,#0F1B2B)",
          borderRadius: 14,
          padding: "18px 20px",
          border: "1px solid rgba(94,234,212,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ color: "#E0E7FF", margin: 0, fontSize: 18, fontWeight: 800 }}>👥 Headcount</h2>
            <div style={{ color: "#88A0B8", fontSize: 12, marginTop: 4 }}>
              Half-wise headcount master with multi-select filters, sort, export, select all, and controlled import.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => downloadTextFile("headcount_template.csv", templateCsv, "text/csv;charset=utf-8")}
              style={{
                background: "rgba(94,234,212,0.08)",
                border: "1px solid rgba(94,234,212,0.30)",
                borderRadius: 10,
                color: "#D2FFFB",
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              ⬇ Download Template
            </button>

            {canExport && (
              <button
                onClick={handleExport}
                style={{
                  background: "rgba(96,165,250,0.08)",
                  border: "1px solid rgba(96,165,250,0.30)",
                  borderRadius: 10,
                  color: "#DBEAFE",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                ⬇ Export
              </button>
            )}

            {canImport && (
              <button
                onClick={() => setShowImport(true)}
                style={{
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.30)",
                  borderRadius: 10,
                  color: "#CFFAFE",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                📥 Import Headcount
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <MultiSelect label="All Years" options={fyOptions} selected={selectedFYs} onChange={setSelectedFYs} minWidth={170} />
          <MultiSelect label="All BUs" options={buOptions} selected={selectedBUs} onChange={setSelectedBUs} minWidth={170} />
          <MultiSelect label="All Locations" options={locationOptions} selected={selectedLocations} onChange={setSelectedLocations} minWidth={180} />
          <MultiSelect label="All Departments" options={departmentOptions} selected={selectedDepartments} onChange={setSelectedDepartments} minWidth={190} />
          <MultiSelect label="All Emp Types" options={EMP_TYPES} selected={selectedEmpTypes} onChange={setSelectedEmpTypes} minWidth={170} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email / BU / location / department"
            style={{
              minWidth: 260,
              background: "#09131D",
              border: "1px solid #213547",
              borderRadius: 10,
              color: "#E6FFFD",
              padding: "10px 14px",
              fontSize: 13,
            }}
          />

          <button
            onClick={() => {
              setSelectedFYs(["all"]);
              setSelectedBUs(["all"]);
              setSelectedLocations(["all"]);
              setSelectedDepartments(["all"]);
              setSelectedEmpTypes(["all"]);
              setSearch("");
              setSelectedIds(new Set());
            }}
            style={{
              background: "#450a0a",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              color: "#f87171",
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ✕ Reset
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {kpiCard("Total Headcount", totalHeadcount, "#5EEAD4")}
        {kpiCard("Selected FY/Halves", selectedHalfCount, "#7C8CFF")}
        {kpiCard("BUs in Scope", totalBUsInScope, "#60A5FA")}
        {kpiCard("Locations in Scope", totalLocationsInScope, "#F59E0B")}
        {kpiCard("Departments in Scope", totalDepartmentsInScope, "#10B981")}
      </div>

      {selectedCount > 0 && canDelete && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "linear-gradient(90deg,#1a0a0a,#1f1010)",
            border: "1px solid #ef444440",
            borderRadius: 10,
            padding: "10px 16px",
          }}
        >
          <span style={{ color: "#fca5a5", fontWeight: 700, fontSize: 13 }}>
            🗑️ {selectedCount} row{selectedCount > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleDeleteSelected}
            style={{
              background: "linear-gradient(135deg,#ef4444,#b91c1c)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              padding: "6px 18px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Delete Selected ({selectedCount})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: "#213547",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 8,
              color: "#94a3b8",
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#E0E7FF", fontSize: 15, fontWeight: 800 }}>Headcount Table</div>
            <div style={{ color: "#88A0B8", fontSize: 12, marginTop: 4 }}>
              Supports Select Multiple, Select All, Export, and Delete Selected.
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 12px", width: 36, background: "#09131D", borderBottom: "1px solid #1f3142" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!canDelete} />
                </th>
                {[
                  ["userEmailId", "User Email ID"],
                  ["businessUnit", "Business Unit"],
                  ["location", "Location"],
                  ["department", "Department"],
                  ["empType", "Emp. Type"],
                  ["fyHalf", "FY & Half"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as keyof HeadcountRecord)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      background: "#09131D",
                      color: sortKey === key ? "#E6FFFD" : "#5EEAD4",
                      borderBottom: "1px solid #1f3142",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontSize: 12,
                    }}
                  >
                    {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                  </th>
                ))}
                <th
  style={{
    textAlign: "left",
    padding: "10px 12px",
    background: "#09131D",
    color: "#9fb3c8",
    borderBottom: "1px solid #1f3142",
    fontSize: 12,
    whiteSpace: "nowrap",
  }}
>
  Actions
</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "20px 12px", color: "#94a3b8", textAlign: "center" }}>
                    No headcount records found for the selected filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const rowId = row.id || `${row.userEmailId}__${row.fyHalf}`;
                  const isEditing = editingRowId === rowId;
                  return (
                    <tr key={rowId}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rowId)}
                          onChange={() => toggleOne(rowId)}
                          disabled={!canDelete}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", color: "#E5EEF8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.userEmailId}</td>
                      <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
  {isEditing ? (
  <input
    type="text"
    value={String(editDraft.businessUnit || "")}
    onChange={(e) => {
      setEditError("");
      setEditDraft((prev) => ({ ...prev, businessUnit: e.target.value }));
    }}
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 8,
      color: "#E6FFFD",
      padding: "6px 8px",
    }}
  />
) : (
  row.businessUnit
)}
</td>
                      <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
  {isEditing ? (
  <input
    type="text"
    value={String(editDraft.location || "")}
    onChange={(e) => {
      setEditError("");
      setEditDraft((prev) => ({ ...prev, location: e.target.value }));
    }}
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 8,
      color: "#E6FFFD",
      padding: "6px 8px",
    }}
  />
) : (
  row.location
)}
</td>
                      <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
  {isEditing ? (
  <input
    type="text"
    value={String(editDraft.department || "")}
    onChange={(e) => {
      setEditError("");
      setEditDraft((prev) => ({ ...prev, department: e.target.value }));
    }}
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 8,
      color: "#E6FFFD",
      padding: "6px 8px",
    }}
  />
) : (
  row.department
)}
</td>
                      <td style={{ padding: "10px 12px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
  {isEditing ? (
  <input
    type="text"
    value={String(editDraft.empType || "")}
    onChange={(e) => {
      setEditError("");
      setEditDraft((prev) => ({ ...prev, empType: e.target.value }));
    }}
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 8,
      color: "#E6FFFD",
      padding: "6px 8px",
    }}
  />
) : (
  row.empType
)}
</td>
                      <td style={{ padding: "10px 12px", color: "#7dd3fc", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
  {isEditing ? (
  <input
    type="text"
    value={String(editDraft.fyHalf || "")}
    onChange={(e) => {
      setEditError("");
      setEditDraft((prev) => ({ ...prev, fyHalf: e.target.value }));
    }}
    placeholder="YYYY-H1 or YYYY-H2"
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 8,
      color: "#E6FFFD",
      padding: "6px 8px",
    }}
  />
) : (
  row.fyHalf
)}
</td>
                      <td
  style={{
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  }}
>
  {isEditing ? (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <button
  disabled={isSavingEdit}
      style={{
  background: isSavingEdit ? "#334155" : "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.35)",
  borderRadius: 8,
  color: isSavingEdit ? "#94a3b8" : "#BBF7D0",
  padding: "6px 10px",
  cursor: isSavingEdit ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: 12,
  opacity: isSavingEdit ? 0.8 : 1,
}}
      onClick={() => {
        handleSaveEdit(rowId);
      }}
    >
      {isSavingEdit ? "Saving..." : "Save"}
    </button>

    <button
      style={{
        background: "rgba(239,68,68,0.10)",
        border: "1px solid rgba(239,68,68,0.30)",
        borderRadius: 8,
        color: "#FECACA",
        padding: "6px 10px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 12,
      }}
      onClick={() => {
  setEditingRowId(null);
  setEditDraft({});
  setEditError("");
}}
    >
      Cancel
    </button>
    {editError && editingRowId === rowId && (
  <div style={{ color: "#fca5a5", fontSize: 12, fontWeight: 700 }}>
    {editError}
  </div>
)}
  </div>
) : (
  <button
    style={{
      background: "rgba(124,140,255,0.08)",
      border: "1px solid rgba(124,140,255,0.30)",
      borderRadius: 8,
      color: "#D2E0FF",
      padding: "6px 10px",
      cursor: canImport ? "pointer" : "not-allowed",
      fontWeight: 700,
      fontSize: 12,
      opacity: canImport ? 1 : 0.6,
    }}
    disabled={!canImport}
    onClick={() => {
      setEditingRowId(rowId);
      setEditDraft({
        userEmailId: row.userEmailId,
        businessUnit: row.businessUnit,
        location: row.location,
        department: row.department,
        empType: row.empType,
        fyHalf: row.fyHalf,
      });
    }}
  >
    Edit
  </button>
)}
</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
      flexWrap: "wrap",
    }}
  >
    <div>
  <div style={{ color: "#88A0B8", fontSize: 12 }}>
    Showing {(currentPage - 1) * pageSize + 1}–
    {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} loaded rows
  </div>

  {hasMore && (
    <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 4, fontWeight: 700 }}>
      More rows are available in the cloud. Current view is not the full dataset yet.
    </div>
  )}
</div>

    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        style={{
          background: "#09131D",
          border: "1px solid #213547",
          borderRadius: 8,
          color: currentPage === 1 ? "#64748b" : "#E6FFFD",
          padding: "6px 12px",
          cursor: currentPage === 1 ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        Prev
      </button>

      <div style={{ color: "#E6FFFD", fontSize: 12, fontWeight: 700 }}>
        Page {currentPage} / {totalPages}
      </div>

      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        style={{
          background: "#09131D",
          border: "1px solid #213547",
          borderRadius: 8,
          color: currentPage === totalPages ? "#64748b" : "#E6FFFD",
          padding: "6px 12px",
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
          fontWeight: 700,
        }}
      >
        Next
      </button>
      {hasMore && (
  <button
    onClick={onLoadMore}
    disabled={isLoadingMore}
    style={{
      background: isLoadingMore ? "#334155" : "rgba(94,234,212,0.08)",
      border: "1px solid rgba(94,234,212,0.30)",
      borderRadius: 8,
      color: isLoadingMore ? "#94a3b8" : "#D2FFFB",
      padding: "6px 12px",
      cursor: isLoadingMore ? "not-allowed" : "pointer",
      fontWeight: 700,
      fontSize: 12,
      opacity: isLoadingMore ? 0.8 : 1,
    }}
  >
    {isLoadingMore ? "Loading..." : "Load More"}
  </button>
)}
    </div>
  </div>
)}
      </div>
    </div>
  );
}
