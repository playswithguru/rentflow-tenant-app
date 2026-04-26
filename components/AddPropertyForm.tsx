"use client";

import { useEffect, useMemo, useState } from "react";
import { addProperty, fetchLandlords } from "@/lib/api";

type Mode = "create" | "edit";

export type PropertyFormValues = {
  PropertyID?: string;
  LandlordID: string;
  PropertyName: string;
  Address?: string;
  City?: string;
  Neighborhood?: string;
  PropertyType?: string;
  TotalUnits?: string | number;
  ManagerName?: string;
  ManagerPhone?: string;
  Status?: string;
};

type Props = {
  mode?: Mode;
  initialData?: Partial<PropertyFormValues> | null;
  onSuccess?: (result?: any, values?: PropertyFormValues) => void;
  onCancel?: () => void;
  saveRecord?: (values: PropertyFormValues, mode: Mode) => Promise<any>;
};

const EMPTY_FORM: PropertyFormValues = {
  LandlordID: "",
  PropertyName: "",
  Address: "",
  City: "Douala",
  Neighborhood: "",
  PropertyType: "Apartment",
  TotalUnits: "",
  ManagerName: "",
  ManagerPhone: "",
  Status: "Active",
};

function buildInitialForm(initialData?: Partial<PropertyFormValues> | null): PropertyFormValues {
  return {
    ...EMPTY_FORM,
    ...(initialData || {}),
  };
}

export default function AddPropertyForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  saveRecord,
}: Props) {
  const [form, setForm] = useState<PropertyFormValues>(buildInitialForm(initialData));
  const [landlords, setLandlords] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingLandlords, setLoadingLandlords] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditMode = mode === "edit";
  const submitLabel = useMemo(
    () => (isEditMode ? "Update property" : "Save property"),
    [isEditMode]
  );

  useEffect(() => {
    setForm(buildInitialForm(initialData));
    setMessage("");
    setError("");
  }, [initialData, mode]);

  useEffect(() => {
    async function loadLandlords() {
      try {
        const res = await fetchLandlords();
        const landlordData = res?.data || [];
        setLandlords(landlordData);

        setForm((prev) => ({
          ...prev,
          LandlordID: prev.LandlordID || landlordData[0]?.LandlordID || "",
        }));
      } catch (err) {
        console.error("Failed to load landlords", err);
      } finally {
        setLoadingLandlords(false);
      }
    }

    loadLandlords();
  }, []);

  function updateField(key: keyof PropertyFormValues, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function defaultSave(values: PropertyFormValues) {
    if (isEditMode) {
      throw new Error("Edit mode requires a saveRecord handler until updateProperty is added to the API.");
    }
    return addProperty(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await (saveRecord ? saveRecord(form, mode) : defaultSave(form));

      if (result && result.success === false) {
        throw new Error(result.error || `Failed to ${isEditMode ? "update" : "add"} property`);
      }

      setMessage(
        isEditMode
          ? "Property updated successfully"
          : `Property created successfully${result?.id ? `: ${result.id}` : ""}`
      );

      if (!isEditMode) {
        setForm((prev) => ({
          ...EMPTY_FORM,
          LandlordID: prev.LandlordID,
        }));
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Landlord</label>
        <select
          value={form.LandlordID}
          onChange={(e) => updateField("LandlordID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          required
          disabled={loadingLandlords}
        >
          {landlords.length === 0 ? (
            <option value="">
              {loadingLandlords ? "Loading landlords..." : "No landlords found"}
            </option>
          ) : (
            landlords.map((landlord) => (
              <option key={landlord.LandlordID} value={landlord.LandlordID}>
                {landlord.Name} ({landlord.LandlordID})
              </option>
            ))
          )}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Property name</label>
        <input
          type="text"
          value={form.PropertyName}
          onChange={(e) => updateField("PropertyName", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Bonapriso Residence"
          required
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Address</label>
        <input
          type="text"
          value={form.Address || ""}
          onChange={(e) => updateField("Address", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Bonapriso Main Road"
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Neighborhood</label>
        <input
          type="text"
          value={form.Neighborhood || ""}
          onChange={(e) => updateField("Neighborhood", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Bonapriso"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Property type</label>
        <select
          value={form.PropertyType || "Apartment"}
          onChange={(e) => updateField("PropertyType", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          <option value="Apartment">Apartment</option>
          <option value="House">House</option>
          <option value="Mixed">Mixed</option>
          <option value="Commercial">Commercial</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Total units</label>
        <input
          type="number"
          min="0"
          value={String(form.TotalUnits ?? "")}
          onChange={(e) => updateField("TotalUnits", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="12"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Manager name</label>
        <input
          type="text"
          value={form.ManagerName || ""}
          onChange={(e) => updateField("ManagerName", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Teku"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Manager phone</label>
        <input
          type="text"
          value={form.ManagerPhone || ""}
          onChange={(e) => updateField("ManagerPhone", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="670000000"
        />
      </div>

      <div className="md:col-span-2">
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

      <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !form.LandlordID}
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
