"use client";

import { useEffect, useMemo, useState } from "react";
import { addTenant, fetchAllProperties, fetchAllUnits } from "@/lib/api";

type Mode = "create" | "edit";

export type TenantFormValues = {
  TenantID?: string;
  FullName: string;
  Phone?: string;
  Email?: string;
  NationalID?: string;
  PropertyID: string;
  UnitID: string;
  LeaseStartDate?: string;
  LeaseEndDate?: string;
  RentAmount?: string | number;
  DepositPaid?: string | number;
  Status?: string;
  EmergencyContact?: string;
  Notes?: string;
};

type Props = {
  mode?: Mode;
  initialData?: Partial<TenantFormValues> | null;
  onSuccess?: (result?: any, values?: TenantFormValues) => void;
  onCancel?: () => void;
  saveRecord?: (values: TenantFormValues, mode: Mode) => Promise<any>;
};

const EMPTY_FORM: TenantFormValues = {
  FullName: "",
  Phone: "",
  Email: "",
  NationalID: "",
  PropertyID: "",
  UnitID: "",
  LeaseStartDate: "",
  LeaseEndDate: "",
  RentAmount: "",
  DepositPaid: "",
  Status: "Active",
  EmergencyContact: "",
  Notes: "",
};

function buildInitialForm(initialData?: Partial<TenantFormValues> | null): TenantFormValues {
  return {
    ...EMPTY_FORM,
    ...(initialData || {}),
  };
}

export default function RegisterTenantForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  saveRecord,
}: Props) {
  const [form, setForm] = useState<TenantFormValues>(buildInitialForm(initialData));
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditMode = mode === "edit";
  const submitLabel = useMemo(
    () => (isEditMode ? "Update tenant" : "Save tenant"),
    [isEditMode]
  );

  useEffect(() => {
    setForm(buildInitialForm(initialData));
    setMessage("");
    setError("");
  }, [initialData, mode]);

  useEffect(() => {
    async function loadData() {
      try {
        const [propertiesRes, unitsRes] = await Promise.all([
          fetchAllProperties(),
          fetchAllUnits(),
        ]);

        const propertyData = propertiesRes?.data || [];
        const unitData = unitsRes?.data || [];

        setProperties(propertyData);
        setUnits(unitData);

        setForm((prev) => {
          const propertyId = prev.PropertyID || propertyData[0]?.PropertyID || "";

          if (prev.UnitID) {
            return {
              ...prev,
              PropertyID: propertyId,
            };
          }

          const candidateUnits = unitData.filter((u: any) => {
            if (u.PropertyID !== propertyId) return false;
            if (isEditMode && initialData?.UnitID && u.UnitID === initialData.UnitID) return true;
            return String(u.Status || "").toLowerCase() === "vacant";
          });

          return {
            ...prev,
            PropertyID: propertyId,
            UnitID: candidateUnits[0]?.UnitID || "",
          };
        });
      } catch (err) {
        console.error("Failed to load tenant dependencies", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [isEditMode, initialData?.UnitID]);

  const filteredUnits = useMemo(() => {
    return units.filter((unit: any) => {
      if (unit.PropertyID !== form.PropertyID) return false;
      if (isEditMode && initialData?.UnitID && unit.UnitID === initialData.UnitID) return true;
      return String(unit.Status || "").toLowerCase() === "vacant";
    });
  }, [units, form.PropertyID, isEditMode, initialData?.UnitID]);

  useEffect(() => {
    const stillValid = filteredUnits.some((u: any) => u.UnitID === form.UnitID);
    if (!stillValid) {
      setForm((prev) => ({
        ...prev,
        UnitID: filteredUnits[0]?.UnitID || "",
      }));
    }
  }, [filteredUnits, form.UnitID]);

  function updateField(key: keyof TenantFormValues, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function defaultSave(values: TenantFormValues) {
    if (isEditMode) {
      throw new Error("Edit mode requires a saveRecord handler until updateTenant is added to the API.");
    }
    return addTenant(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await (saveRecord ? saveRecord(form, mode) : defaultSave(form));

      if (result && result.success === false) {
        throw new Error(result.error || `Failed to ${isEditMode ? "update" : "register"} tenant`);
      }

      setMessage(
        isEditMode
          ? "Tenant updated successfully"
          : `Tenant created successfully${result?.id ? `: ${result.id}` : ""}`
      );

      if (!isEditMode) {
        setForm((prev) => ({
          ...EMPTY_FORM,
          PropertyID: prev.PropertyID,
          UnitID: "",
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
        <input
          type="text"
          value={form.FullName}
          onChange={(e) => updateField("FullName", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Marie Ndzi"
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
          placeholder="677000111"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={form.Email || ""}
          onChange={(e) => updateField("Email", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="marie@example.com"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">National ID</label>
        <input
          type="text"
          value={form.NationalID || ""}
          onChange={(e) => updateField("NationalID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="ID12345"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Emergency contact</label>
        <input
          type="text"
          value={form.EmergencyContact || ""}
          onChange={(e) => updateField("EmergencyContact", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="677999888"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Property</label>
        <select
          value={form.PropertyID}
          onChange={(e) => updateField("PropertyID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          disabled={loadingData}
          required
        >
          {properties.map((property: any) => (
            <option key={property.PropertyID} value={property.PropertyID}>
              {property.PropertyName} ({property.PropertyID})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
        <select
          value={form.UnitID}
          onChange={(e) => updateField("UnitID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          disabled={loadingData}
          required
        >
          {filteredUnits.length === 0 ? (
            <option value="">No available units</option>
          ) : (
            filteredUnits.map((unit: any) => (
              <option key={unit.UnitID} value={unit.UnitID}>
                {unit.UnitNumber} ({unit.UnitID})
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Lease start date</label>
        <input
          type="date"
          value={form.LeaseStartDate || ""}
          onChange={(e) => updateField("LeaseStartDate", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Lease end date</label>
        <input
          type="date"
          value={form.LeaseEndDate || ""}
          onChange={(e) => updateField("LeaseEndDate", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Deposit paid</label>
        <input
          type="number"
          min="0"
          value={String(form.DepositPaid ?? "")}
          onChange={(e) => updateField("DepositPaid", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="300000"
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
          <option value="Notice">Notice</option>
          <option value="Former">Former</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          value={form.Notes || ""}
          onChange={(e) => updateField("Notes", e.target.value)}
          className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="Additional tenant notes"
        />
      </div>

      <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !form.PropertyID || !form.UnitID}
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
