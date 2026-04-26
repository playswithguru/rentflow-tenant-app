"use client";

import { useEffect, useMemo, useState } from "react";
import { addUnit, fetchAllProperties } from "@/lib/api";

type Mode = "create" | "edit";

export type UnitFormValues = {
  UnitID?: string;
  PropertyID: string;
  UnitNumber: string;
  UnitType?: string;
  Bedrooms?: string | number;
  Bathrooms?: string | number;
  Floor?: string;
  RentAmount?: string | number;
  DepositAmount?: string | number;
  Status?: string;
  Notes?: string;
};

type Props = {
  mode?: Mode;
  initialData?: Partial<UnitFormValues> | null;
  onSuccess?: (result?: any, values?: UnitFormValues) => void;
  onCancel?: () => void;
  saveRecord?: (values: UnitFormValues, mode: Mode) => Promise<any>;
};

const EMPTY_FORM: UnitFormValues = {
  PropertyID: "",
  UnitNumber: "",
  UnitType: "Apartment",
  Bedrooms: "",
  Bathrooms: "",
  Floor: "",
  RentAmount: "",
  DepositAmount: "",
  Status: "Vacant",
  Notes: "",
};

const UNIT_TYPE_OPTIONS = [
  "Apartment",
  "Studio",
  "1BR",
  "2BR",
  "3BR",
  "Shop",
  "Office",
];

function buildInitialForm(initialData?: Partial<UnitFormValues> | null): UnitFormValues {
  return {
    ...EMPTY_FORM,
    ...(initialData || {}),
  };
}

export default function AddUnitForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  saveRecord,
}: Props) {
  const [form, setForm] = useState<UnitFormValues>(buildInitialForm(initialData));
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditMode = mode === "edit";
  const submitLabel = useMemo(
    () => (isEditMode ? "Update unit" : "Save unit"),
    [isEditMode]
  );

  useEffect(() => {
    setForm(buildInitialForm(initialData));
    setMessage("");
    setError("");
  }, [initialData, mode]);

  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetchAllProperties();
        const propertyData = res?.data || [];
        setProperties(propertyData);

        setForm((prev) => ({
          ...prev,
          PropertyID: prev.PropertyID || propertyData[0]?.PropertyID || "",
        }));
      } catch (err) {
        console.error("Failed to load properties", err);
      } finally {
        setLoadingProperties(false);
      }
    }

    loadProperties();
  }, []);

  function updateField(key: keyof UnitFormValues, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function defaultSave(values: UnitFormValues) {
    if (isEditMode) {
      throw new Error("Edit mode requires a saveRecord handler until updateUnit is added to the API.");
    }
    return addUnit(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await (saveRecord ? saveRecord(form, mode) : defaultSave(form));

      if (result && result.success === false) {
        throw new Error(result.error || `Failed to ${isEditMode ? "update" : "add"} unit`);
      }

      setMessage(
        isEditMode
          ? "Unit updated successfully"
          : `Unit created successfully${result?.id ? `: ${result.id}` : ""}`
      );

      if (!isEditMode) {
        setForm((prev) => ({
          ...EMPTY_FORM,
          PropertyID: prev.PropertyID,
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Property</label>
        <select
          value={form.PropertyID}
          onChange={(e) => updateField("PropertyID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          required
          disabled={loadingProperties}
        >
          {properties.length === 0 ? (
            <option value="">
              {loadingProperties ? "Loading properties..." : "No properties found"}
            </option>
          ) : (
            properties.map((property) => (
              <option key={property.PropertyID} value={property.PropertyID}>
                {property.PropertyName} ({property.PropertyID})
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Unit number</label>
        <input
          type="text"
          value={form.UnitNumber}
          onChange={(e) => updateField("UnitNumber", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="A-01"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Unit type</label>
        <select
          value={form.UnitType || "Apartment"}
          onChange={(e) => updateField("UnitType", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          {UNIT_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Bedrooms</label>
        <input
          type="number"
          min="0"
          value={String(form.Bedrooms ?? "")}
          onChange={(e) => updateField("Bedrooms", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="2"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Bathrooms</label>
        <input
          type="number"
          min="0"
          value={String(form.Bathrooms ?? "")}
          onChange={(e) => updateField("Bathrooms", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="2"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Floor</label>
        <input
          type="text"
          value={form.Floor || ""}
          onChange={(e) => updateField("Floor", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="1"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Rent amount</label>
        <input
          type="number"
          min="0"
          value={String(form.RentAmount ?? "")}
          onChange={(e) => updateField("RentAmount", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="150000"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Deposit amount</label>
        <input
          type="number"
          min="0"
          value={String(form.DepositAmount ?? "")}
          onChange={(e) => updateField("DepositAmount", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="300000"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
        <select
          value={form.Status || "Vacant"}
          onChange={(e) => updateField("Status", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          <option value="Vacant">Vacant</option>
          <option value="Occupied">Occupied</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          value={form.Notes || ""}
          onChange={(e) => updateField("Notes", e.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Freshly painted, sea view, etc."
        />
      </div>

      <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !form.PropertyID}
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
