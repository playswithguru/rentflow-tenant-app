"use client";

import { useEffect, useMemo, useState } from "react";
import { addLandlord } from "@/lib/api";

type Mode = "create" | "edit";

export type LandlordFormValues = {
  LandlordID?: string;
  Name: string;
  Phone?: string;
  Email?: string;
  Address?: string;
  City?: string;
  Country?: string;
  Status?: string;
  Notes?: string;
};

type Props = {
  mode?: Mode;
  initialData?: Partial<LandlordFormValues> | null;
  onSuccess?: (result?: any, values?: LandlordFormValues) => void;
  onCancel?: () => void;
  saveRecord?: (values: LandlordFormValues, mode: Mode) => Promise<any>;
};

const EMPTY_FORM: LandlordFormValues = {
  Name: "",
  Phone: "",
  Email: "",
  Address: "",
  City: "",
  Country: "Cameroon",
  Status: "Active",
  Notes: "",
};

function buildInitialForm(initialData?: Partial<LandlordFormValues> | null): LandlordFormValues {
  return {
    ...EMPTY_FORM,
    ...(initialData || {}),
  };
}

export default function AddLandlordForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  saveRecord,
}: Props) {
  const [form, setForm] = useState<LandlordFormValues>(buildInitialForm(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditMode = mode === "edit";
  const submitLabel = useMemo(
    () => (isEditMode ? "Update landlord" : "Save landlord"),
    [isEditMode]
  );

  useEffect(() => {
    setForm(buildInitialForm(initialData));
    setMessage("");
    setError("");
  }, [initialData, mode]);

  function updateField(key: keyof LandlordFormValues, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function defaultSave(values: LandlordFormValues) {
    if (isEditMode) {
      throw new Error("Edit mode requires a saveRecord handler until updateLandlord is added to the API.");
    }
    return addLandlord(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await (saveRecord
        ? saveRecord(form, mode)
        : defaultSave(form));

      if (result && result.success === false) {
        throw new Error(result.error || `Failed to ${isEditMode ? "update" : "add"} landlord`);
      }

      setMessage(
        isEditMode
          ? "Landlord updated successfully"
          : `Landlord created successfully${result?.id ? `: ${result.id}` : ""}`
      );

      if (!isEditMode) {
        setForm(buildInitialForm(null));
      }

      onSuccess?.(result, form);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Full name / business name
        </label>
        <input
          type="text"
          value={form.Name}
          onChange={(e) => updateField("Name", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Teku Properties"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
        <input
          type="text"
          value={form.Phone || ""}
          onChange={(e) => updateField("Phone", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="670000000"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={form.Email || ""}
          onChange={(e) => updateField("Email", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="info@example.com"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Address</label>
        <input
          type="text"
          value={form.Address || ""}
          onChange={(e) => updateField("Address", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Bonapriso"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">City</label>
        <input
          type="text"
          value={form.City || ""}
          onChange={(e) => updateField("City", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Douala"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Country</label>
        <input
          type="text"
          value={form.Country || ""}
          onChange={(e) => updateField("Country", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
        <select
          value={form.Status || "Active"}
          onChange={(e) => updateField("Status", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          value={form.Notes || ""}
          onChange={(e) => updateField("Notes", e.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Priority customer, portfolio owner, etc."
        />
      </div>

      <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-fit rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>

        {isEditMode && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-fit rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        ) : null}

        {message ? <p className="basis-full text-sm font-medium text-emerald-600">{message}</p> : null}
        {error ? <p className="basis-full text-sm font-medium text-rose-600">{error}</p> : null}
      </div>
    </form>
  );
}
