"use client";

import { useEffect, useMemo, useState } from "react";
import { addPayment, fetchAllProperties, fetchAllTenants } from "@/lib/api";

type Mode = "create" | "edit";

export type PaymentFormValues = {
  PaymentID?: string;
  PropertyID: string;
  UnitID: string;
  TenantID: string;
  PaymentDate: string;
  AmountPaid: string | number;
  PaymentType?: string;
  PeriodCovered?: string;
  BalanceAfter?: string | number;
  PaymentMethod?: string;
  Reference?: string;
  RecordedBy?: string;
};

type Props = {
  mode?: Mode;
  initialData?: Partial<PaymentFormValues> | null;
  onSuccess?: (result?: any, values?: PaymentFormValues) => void;
  onCancel?: () => void;
  saveRecord?: (values: PaymentFormValues, mode: Mode) => Promise<any>;
};

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM: PaymentFormValues = {
  PropertyID: "",
  UnitID: "",
  TenantID: "",
  PaymentDate: today(),
  AmountPaid: "",
  PaymentType: "Rent",
  PeriodCovered: today(),
  BalanceAfter: "0",
  PaymentMethod: "Cash",
  Reference: "",
  RecordedBy: "Admin",
};

function buildInitialForm(initialData?: Partial<PaymentFormValues> | null): PaymentFormValues {
  return {
    ...EMPTY_FORM,
    ...(initialData || {}),
  };
}

export default function LogPaymentForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  saveRecord,
}: Props) {
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [form, setForm] = useState<PaymentFormValues>(buildInitialForm(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditMode = mode === "edit";
  const submitLabel = useMemo(
    () => (isEditMode ? "Update payment" : "Log payment"),
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
        const [propertiesRes, tenantsRes] = await Promise.all([
          fetchAllProperties(),
          fetchAllTenants(),
        ]);

        const propertyData = propertiesRes?.data || [];
        const tenantData = tenantsRes?.data || [];

        setProperties(propertyData);
        setTenants(tenantData);

        setForm((prev) => {
          const propertyId = prev.PropertyID || propertyData[0]?.PropertyID || "";

          if (prev.TenantID && prev.UnitID) {
            return {
              ...prev,
              PropertyID: propertyId,
            };
          }

          const firstTenant = tenantData.find((t: any) => t.PropertyID === propertyId);
          return {
            ...prev,
            PropertyID: propertyId,
            TenantID: prev.TenantID || firstTenant?.TenantID || "",
            UnitID: prev.UnitID || firstTenant?.UnitID || "",
            PaymentDate: prev.PaymentDate || today(),
            PeriodCovered: prev.PeriodCovered || today(),
          };
        });
      } catch (err) {
        console.error("Failed to load payment dependencies", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant: any) => tenant.PropertyID === form.PropertyID);
  }, [tenants, form.PropertyID]);

  useEffect(() => {
    const selectedTenant = filteredTenants.find((tenant: any) => tenant.TenantID === form.TenantID);

    if (selectedTenant) {
      setForm((prev) => ({
        ...prev,
        UnitID: selectedTenant.UnitID || prev.UnitID,
      }));
    } else if (filteredTenants.length > 0 && !form.TenantID) {
      setForm((prev) => ({
        ...prev,
        TenantID: filteredTenants[0].TenantID,
        UnitID: filteredTenants[0].UnitID || "",
      }));
    }
  }, [filteredTenants, form.TenantID]);

  function updateField(key: keyof PaymentFormValues, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function defaultSave(values: PaymentFormValues) {
    if (isEditMode) {
      throw new Error("Edit mode requires a saveRecord handler until updatePayment is added to the API.");
    }
    return addPayment(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await (saveRecord ? saveRecord(form, mode) : defaultSave(form));

      if (result && result.success === false) {
        throw new Error(result.error || `Failed to ${isEditMode ? "update" : "log"} payment`);
      }

      setMessage(
        isEditMode
          ? "Payment updated successfully"
          : `Payment logged successfully${result?.id ? `: ${result.id}` : ""}`
      );

      if (!isEditMode) {
        setForm((prev) => ({
          ...prev,
          AmountPaid: "",
          Reference: "",
          BalanceAfter: "0",
          PaymentDate: today(),
          PeriodCovered: today(),
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
        <label className="mb-2 block text-sm font-medium text-slate-700">Tenant</label>
        <select
          value={form.TenantID}
          onChange={(e) => updateField("TenantID", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          disabled={loadingData}
          required
        >
          {filteredTenants.map((tenant: any) => (
            <option key={tenant.TenantID} value={tenant.TenantID}>
              {tenant.FullName} ({tenant.TenantID})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Unit ID</label>
        <input
          type="text"
          value={form.UnitID}
          readOnly
          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Payment date</label>
        <input
          type="date"
          value={form.PaymentDate}
          onChange={(e) => updateField("PaymentDate", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Amount paid</label>
        <input
          type="number"
          min="0"
          value={String(form.AmountPaid ?? "")}
          onChange={(e) => updateField("AmountPaid", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="150000"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Payment type</label>
        <select
          value={form.PaymentType || "Rent"}
          onChange={(e) => updateField("PaymentType", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          <option value="Rent">Rent</option>
          <option value="Deposit">Deposit</option>
          <option value="Advance">Advance</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Period covered</label>
        <input
          type="date"
          value={form.PeriodCovered || ""}
          onChange={(e) => updateField("PeriodCovered", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Balance after</label>
        <input
          type="number"
          min="0"
          value={String(form.BalanceAfter ?? "")}
          onChange={(e) => updateField("BalanceAfter", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="0"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Payment method</label>
        <select
          value={form.PaymentMethod || "Cash"}
          onChange={(e) => updateField("PaymentMethod", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        >
          <option value="Cash">Cash</option>
          <option value="Transfer">Transfer</option>
          <option value="Mobile">Mobile</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Reference</label>
        <input
          type="text"
          value={form.Reference || ""}
          onChange={(e) => updateField("Reference", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          placeholder="RCPT-001"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">Recorded by</label>
        <input
          type="text"
          value={form.RecordedBy || "Admin"}
          onChange={(e) => updateField("RecordedBy", e.target.value)}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />
      </div>

      <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !form.TenantID || !form.PropertyID || !form.UnitID}
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
