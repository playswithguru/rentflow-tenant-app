"use client";

import { useEffect, useState } from "react";
import AddLandlordForm from "@/components/AddLandlordForm";
import AddPropertyForm from "@/components/AddPropertyForm";
import AddUnitForm from "@/components/AddUnitForm";
import RegisterTenantForm from "@/components/RegisterTenantForm";
import LogPaymentForm from "@/components/LogPaymentForm";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/firebaseConfig";
import { useRouter } from "next/navigation";


import {
  fetchDashboardSummary,
  fetchPayments,
  fetchProperties,
  fetchLandlords,
  fetchAllUnits,
  fetchTenants,
  fetchAllTenants,
  updateLandlord,
  updateProperty,
  updateUnit,
  updateTenant,
  updatePayment,
} from "@/lib/api";

type ActiveView =
  | "dashboard"
  | "landlords"
  | "properties"
  | "units"
  | "tenants"
  | "payments"
  | "reports";

type ActiveModal =
  | null
  | "addLandlord"
  | "addProperty"
  | "addUnit"
  | "addTenant"
  | "logPayment";


export default function RentFlowDashboard({
  userRole,
  landlordId,
}: {
  userRole?: string;
  landlordId?: string | null;
}) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeView, setActiveView] = useState<ActiveView>("dashboard");
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  
    const [summary, setSummary] = useState<any>({});
    const [overdueTenants, setOverdueTenants] = useState<any[]>([]);
    const [properties, setProperties] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [tenants, setTenants] = useState<any[]>([]);
    const [vacantUnits, setVacantUnits] = useState<any[]>([]);
    const [dataQualityIssues, setDataQualityIssues] = useState<any[]>([]);
    const [spotlightProperty, setSpotlightProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLandlord, setSelectedLandlord] = useState<any>(null);
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [editingLandlord, setEditingLandlord] = useState<any>(null);
    const [editingProperty, setEditingProperty] = useState<any>(null);
    const [editingUnit, setEditingUnit] = useState<any>(null);
    const [editingTenant, setEditingTenant] = useState<any>(null);
    const [editingPayment, setEditingPayment] = useState<any>(null);
    const [refreshToken, setRefreshToken] = useState(0);
      
      const router = useRouter();

      const handleLogout = async () => {
        try {
          await signOut(auth);
          router.push("/login");
        } catch (e) {
          console.error("Logout failed:", e);
        }
      };
      
      function applyAccessFilter(data: any[], key: string) {
        if (!landlordId || userRole === "super_admin") return data;

        return data.filter(
          (item) => String(item[key] || "") === String(landlordId)
        );
      }
      const isSuperAdmin = userRole === "super_admin";
      const isLandlordUser = !isSuperAdmin;

    
  async function loadDashboard() {
    setLoading(true);
    try {
        const [
          summaryRes,
          propertiesRes,
          paymentsRes,
          unitsRes,
          tenantsRes,
        ] = await Promise.all([
          fetchDashboardSummary(),
          fetchProperties(),
          fetchPayments(),
          fetchAllUnits(),
          fetchAllTenants(),
        ]);

        const propertyData = applyAccessFilter(propertiesRes?.data || [], "LandlordID");

        const unitData = (unitsRes?.data || []).filter((u: any) =>
          propertyData.some(p => String(p.PropertyID) === String(u.PropertyID))
        );

        const tenantData = (tenantsRes?.data || []).filter((t: any) =>
          propertyData.some(p => String(p.PropertyID) === String(t.PropertyID))
        );

        const paymentData = (paymentsRes?.data || []).filter((p: any) =>
          propertyData.some(prop => String(prop.PropertyID) === String(p.PropertyID))
        );
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();

        const overdueData = tenantData
          .filter((tenant: any) =>
            ["active", "notice"].includes(String(tenant.Status || "").toLowerCase())
          )
          .map((tenant: any) => {
            const tenantPaymentsThisMonth = paymentData.filter((payment: any) => {
              if (String(payment.TenantID || "") !== String(tenant.TenantID || "")) return false;
              if (!payment.PaymentDate) return false;

              const paymentDate = new Date(payment.PaymentDate);
              return (
                !Number.isNaN(paymentDate.getTime()) &&
                paymentDate.getMonth() === month &&
                paymentDate.getFullYear() === year
              );
            });

            const paidThisMonth = tenantPaymentsThisMonth.reduce(
              (sum: number, payment: any) => sum + safeNum(payment.AmountPaid),
              0
            );

            const leaseRent = safeNum(tenant.RentAmount);
            const outstanding = Math.max(leaseRent - paidThisMonth, 0);

            return {
              ...tenant,
              LeaseRent: leaseRent,
              PaidThisMonth: paidThisMonth,
              Outstanding: outstanding,
            };
          })
          .filter((tenant: any) => tenant.Outstanding > 0);

      const computedSummary = computeDashboardSummary({
        backendSummary: summaryRes?.data || {},
        properties: propertyData,
        units: unitData,
        tenants: tenantData,
        payments: paymentData,
      });

      const enrichedOverdue = overdueData.map((tenant: any) => {
        const property = propertyData.find(
          (p: any) => String(p.PropertyID || "") === String(tenant.PropertyID || "")
        );
        const unit = unitData.find(
          (u: any) => String(u.UnitID || "") === String(tenant.UnitID || "")
        );
      return {
        ...tenant,
        PropertyName: property?.PropertyName || tenant.PropertyName || tenant.PropertyID || "-",
        UnitNumber: unit?.UnitNumber || tenant.UnitNumber || tenant.UnitID || "-",
        Outstanding: safeNum(tenant.Outstanding),
        LeaseRent: safeNum(tenant.LeaseRent || tenant.RentAmount),
      };
      });

      const enrichedPayments = paymentData
        .map((payment: any) => {
          const tenant = tenantData.find(
            (t: any) => String(t.TenantID || "") === String(payment.TenantID || "")
          );
          const property = propertyData.find(
            (p: any) => String(p.PropertyID || "") === String(payment.PropertyID || "")
          );
          return {
            ...payment,
            TenantName: tenant?.FullName || payment.TenantName || payment.TenantID || "-",
            PropertyName:
              property?.PropertyName || payment.PropertyName || payment.PropertyID || "-",
          };
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.PaymentDate || 0).getTime() - new Date(a.PaymentDate || 0).getTime()
        );

      const vacantUnitRows = unitData
        .filter((unit: any) => String(unit.Status || "").toLowerCase() === "vacant")
        .map((unit: any) => {
          const property = propertyData.find(
            (p: any) => String(p.PropertyID || "") === String(unit.PropertyID || "")
          );
          return {
            ...unit,
            PropertyName: property?.PropertyName || unit.PropertyID || "-",
          };
        })
        .sort((a: any, b: any) => safeNum(b.RentAmount) - safeNum(a.RentAmount));

      const issues = buildDataQualityIssues({
        properties: propertyData,
        units: unitData,
        tenants: tenantData,
      });

      setSummary(computedSummary);
      setOverdueTenants(enrichedOverdue);
      setProperties(propertyData);
      setPayments(enrichedPayments.slice(0, 5));
      setUnits(unitData);
      setTenants(tenantData);
      setVacantUnits(vacantUnitRows.slice(0, 6));
      setDataQualityIssues(issues.slice(0, 8));
      setSpotlightProperty(buildSpotlightProperty(propertyData, unitData, tenantData, enrichedPayments));
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function bumpRefresh() {
    setRefreshToken((prev) => prev + 1);
  }

  async function handleSaveLandlord(values: any, mode: "create" | "edit") {
    if (mode === "edit") return updateLandlord(values);
    throw new Error("Create mode should use the default add handler.");
  }

  async function handleSaveProperty(values: any, mode: "create" | "edit") {
    if (mode === "edit") return updateProperty(values);
    throw new Error("Create mode should use the default add handler.");
  }

  async function handleSaveUnit(values: any, mode: "create" | "edit") {
    if (mode === "edit") return updateUnit(values);
    throw new Error("Create mode should use the default add handler.");
  }

  async function handleSaveTenant(values: any, mode: "create" | "edit") {
    if (mode === "edit") return updateTenant(values);
    throw new Error("Create mode should use the default add handler.");
  }

  async function handleSavePayment(values: any, mode: "create" | "edit") {
    if (mode === "edit") return updatePayment(values);
    throw new Error("Create mode should use the default add handler.");
  }

  function resetEditingState() {
    setEditingLandlord(null);
    setEditingProperty(null);
    setEditingUnit(null);
    setEditingTenant(null);
    setEditingPayment(null);
  }

  function openModal(modal: Exclude<ActiveModal, null>) {
    resetEditingState();
    setActiveModal(modal);
    setDrawerOpen(false);
  }

  function closeModal() {
    setActiveModal(null);
    resetEditingState();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
          <TopBar
            onMenuClick={() => setDrawerOpen(true)}
            userRole={userRole}
            onLogout={handleLogout}
          />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenModal={openModal}
        activeView={activeView}
        userRole={userRole}
        onChangeView={(view) => {
          setActiveView(view);
          setSelectedLandlord(null);
          setSelectedProperty(null);
          setSelectedUnit(null);
          setSelectedTenant(null);
          setSelectedPayment(null);
          setDrawerOpen(false);
        }}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {activeView === "dashboard" && (
          <DashboardView
            loading={loading}
            summary={summary}
            overdueTenants={overdueTenants}
            properties={properties}
            payments={payments}
            units={units}
            tenants={tenants}
            vacantUnits={vacantUnits}
            dataQualityIssues={dataQualityIssues}
            spotlightProperty={spotlightProperty}
          />
        )}

          {isSuperAdmin && activeView === "landlords" && !selectedLandlord && (
            <LandlordsView
              key={`landlords-${refreshToken}`}
              onAddLandlord={() => openModal("addLandlord")}
              onSelectLandlord={(landlord) => setSelectedLandlord(landlord)}
              onEditLandlord={(landlord) => {
                setEditingLandlord(landlord);
                setActiveModal("addLandlord");
              }}
            />
          )}

      {isSuperAdmin && activeView === "landlords" && selectedLandlord && (
        <LandlordDetailView
          landlord={selectedLandlord}
          onBack={() => setSelectedLandlord(null)}
        />
      )}

        {activeView === "properties" && !selectedProperty && (
          <PropertiesView
            key={`properties-${refreshToken}`}
            userRole={userRole}
            landlordId={landlordId}
            onAddProperty={() => openModal("addProperty")}
            onSelectProperty={(property) => setSelectedProperty(property)}
            onEditProperty={(property) => {
              setEditingProperty(property);
              setActiveModal("addProperty");
            }}
          />
        )}

        {activeView === "properties" && selectedProperty && (
          <PropertyDetailView
            property={selectedProperty}
            onBack={() => setSelectedProperty(null)}
          />
        )}

        {activeView === "units" && !selectedUnit && (
         <UnitsView
           key={`units-${refreshToken}`}
           userRole={userRole}
           landlordId={landlordId}
           onAddUnit={() => openModal("addUnit")}
           onSelectUnit={(unit) => setSelectedUnit(unit)}
           onEditUnit={(unit) => {
             setEditingUnit(unit);
             setActiveModal("addUnit");
           }}
         />
        )}

        {activeView === "units" && selectedUnit && (
          <UnitDetailView
            unit={selectedUnit}
            onBack={() => setSelectedUnit(null)}
          />
        )}

        {activeView === "tenants" && !selectedTenant && (
         <TenantsView
           key={`tenants-${refreshToken}`}
           userRole={userRole}
           landlordId={landlordId}
           onAddTenant={() => openModal("addTenant")}
           onSelectTenant={(tenant) => setSelectedTenant(tenant)}
           onEditTenant={(tenant) => {
             setEditingTenant(tenant);
             setActiveModal("addTenant");
           }}
         />
        )}

        {activeView === "tenants" && selectedTenant && (
          <TenantDetailView
            tenant={selectedTenant}
            onBack={() => setSelectedTenant(null)}
          />
        )}

        {activeView === "payments" && !selectedPayment && (
           <PaymentsView
             key={`payments-${refreshToken}`}
             userRole={userRole}
             landlordId={landlordId}
             onLogPayment={() => openModal("logPayment")}
             onSelectPayment={(payment) => setSelectedPayment(payment)}
             onEditPayment={(payment) => {
               setEditingPayment(payment);
               setActiveModal("logPayment");
             }}
           />
        )}

        {activeView === "payments" && selectedPayment && (
          <PaymentDetailView
            payment={selectedPayment}
            onBack={() => setSelectedPayment(null)}
          />
        )}

        {activeView === "reports" && (
          <RepositoryPlaceholder
            title="Reports"
            description="Run portfolio summaries, rent roll, overdue balances, occupancy, and landlord-facing statements."
          />
        )}
      </div>

      {activeModal === "addLandlord" ? (
        <Modal
          title={editingLandlord ? "Edit landlord" : "Add landlord"}
          onClose={closeModal}
        >
          <AddLandlordForm
            mode={editingLandlord ? "edit" : "create"}
            initialData={editingLandlord}
            saveRecord={editingLandlord ? handleSaveLandlord : undefined}
            onCancel={closeModal}
            onSuccess={() => {
              closeModal();
              bumpRefresh();
              loadDashboard();
            }}
          />
        </Modal>
      ) : null}

      {activeModal === "addProperty" ? (
        <Modal
          title={editingProperty ? "Edit property" : "Add property"}
          onClose={closeModal}
        >
          <AddPropertyForm
            mode={editingProperty ? "edit" : "create"}
            initialData={editingProperty}
            saveRecord={editingProperty ? handleSaveProperty : undefined}
            onCancel={closeModal}
            onSuccess={() => {
              closeModal();
              bumpRefresh();
              loadDashboard();
            }}
          />
        </Modal>
      ) : null}

      {activeModal === "addUnit" ? (
        <Modal
          title={editingUnit ? "Edit unit" : "Add unit"}
          onClose={closeModal}
        >
          <AddUnitForm
            mode={editingUnit ? "edit" : "create"}
            initialData={editingUnit}
            saveRecord={editingUnit ? handleSaveUnit : undefined}
            onCancel={closeModal}
            onSuccess={() => {
              closeModal();
              bumpRefresh();
              loadDashboard();
            }}
          />
        </Modal>
      ) : null}

      {activeModal === "addTenant" ? (
        <Modal
          title={editingTenant ? "Edit tenant" : "Register tenant"}
          onClose={closeModal}
        >
          <RegisterTenantForm
            mode={editingTenant ? "edit" : "create"}
            initialData={editingTenant}
            saveRecord={editingTenant ? handleSaveTenant : undefined}
            onCancel={closeModal}
            onSuccess={() => {
              closeModal();
              bumpRefresh();
              loadDashboard();
            }}
          />
        </Modal>
      ) : null}

      {activeModal === "logPayment" ? (
        <Modal
          title={editingPayment ? "Edit payment" : "Log payment"}
          onClose={closeModal}
        >
          <LogPaymentForm
            mode={editingPayment ? "edit" : "create"}
            initialData={editingPayment}
            saveRecord={editingPayment ? handleSavePayment : undefined}
            onCancel={closeModal}
            onSuccess={() => {
              closeModal();
              bumpRefresh();
              loadDashboard();
            }}
          />
        </Modal>
      ) : null}
    </main>
  );
}

function PaymentMeta({
  payment,
  tenantName,
}: {
  payment: any;
  tenantName?: string;
}) {
  return (
    <>
      <p className="font-semibold text-slate-900">
        {tenantName || payment.TenantName || payment.TenantID || "-"}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {payment.PeriodCovered
          ? new Date(payment.PeriodCovered).toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            })
          : "No period"}{" "}
        • {payment.PaymentMethod || "N/A"}
      </p>

      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {payment.PaymentDate
          ? new Date(payment.PaymentDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : ""}
      </p>
    </>
  );
}

function LandlordsView({
  onAddLandlord,
  onSelectLandlord,
  onEditLandlord,
}: {
  onAddLandlord: () => void;
  onSelectLandlord: (landlord: any) => void;
  onEditLandlord: (landlord: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [search, setSearch] = useState("");
  const [landlords, setLandlords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLandlords() {
      setLoading(true);
      try {
        const landlordsRes = await fetchLandlords();
        setLandlords(landlordsRes?.data || []);
      } catch (error) {
        console.error("Failed to load landlords:", error);
        setLandlords([]);
      } finally {
        setLoading(false);
      }
    }

    loadLandlords();
  }, []);

  const filteredLandlords = landlords.filter((l) => {
    const q = search.toLowerCase();
    return (
      String(l.Name || "").toLowerCase().includes(q) ||
      String(l.Phone || "").toLowerCase().includes(q) ||
      String(l.Email || "").toLowerCase().includes(q) ||
      String(l.City || "").toLowerCase().includes(q) ||
      String(l.LandlordID || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Landlords
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Browse landlord accounts, portfolio size, contacts, and drill into their properties.
            </p>
          </div>

          <button
            onClick={onAddLandlord}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Add landlord
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search landlords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "card"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "grid"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Card
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading landlords...
        </div>
      ) : filteredLandlords.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          No landlords found.
        </div>
      ) : viewMode === "card" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span>
            <span>Phone</span>
            <span>Email</span>
            <span>City</span>
            <span>Status</span>
            <span>ID</span>
            <span>Actions</span>
          </div>

          {filteredLandlords.map((landlord) => (
            <div
              key={landlord.LandlordID}
              className="grid grid-cols-7 border-t border-slate-200 bg-white px-6 py-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">{landlord.Name || "-"}</span>
              <span className="text-slate-600">{landlord.Phone || "-"}</span>
              <span className="text-slate-600">{landlord.Email || "-"}</span>
              <span className="text-slate-600">{landlord.City || "-"}</span>
              <span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(landlord.Status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {landlord.Status || "Unknown"}
                </span>
              </span>
              <span className="font-medium text-slate-900">{landlord.LandlordID || "-"}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onSelectLandlord(landlord)}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  View
                </button>
                <button
                  onClick={() => onEditLandlord(landlord)}
                  className="text-xs font-medium text-amber-600 hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredLandlords.map((landlord) => (
            <button
              key={landlord.LandlordID}
              onClick={() => onSelectLandlord(landlord)}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {landlord.Name || "-"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{landlord.City || "-"}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(landlord.Status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {landlord.Status || "Unknown"}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p>{landlord.Phone || "-"}</p>
                <p>{landlord.Email || "-"}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Landlord ID
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {landlord.LandlordID || "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LandlordDetailView({
  landlord,
  onBack,
}: {
  landlord: any;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "properties" | "agreements" | "payments">(
    "overview"
  );
  const [properties, setProperties] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLandlordDetail() {
      setLoading(true);
      try {
        const [propertiesRes, paymentsRes, tenantsRes] = await Promise.all([
          fetchProperties(landlord.LandlordID),
          fetchPayments(),
          fetchTenants(),
        ]);
  
        const propertyData = propertiesRes?.data || [];
        const paymentData = paymentsRes?.data || [];
        const tenantData = tenantsRes?.data || [];
  
        const propertyIds = new Set(
          propertyData.map((p: any) => String(p.PropertyID || ""))
        );
  
        const tenantMap = new Map(
          tenantData.map((t: any) => [String(t.TenantID || ""), t])
        );
  
        setProperties(propertyData);
  
        setPayments(
          paymentData
            .filter((p: any) => propertyIds.has(String(p.PropertyID || "")))
            .map((p: any) => ({
              ...p,
              TenantName:
                tenantMap.get(String(p.TenantID || ""))?.FullName || p.TenantID || "-",
            }))
            .sort(
              (a: any, b: any) =>
                new Date(b.PaymentDate || 0).getTime() -
                new Date(a.PaymentDate || 0).getTime()
            )
        );
      } catch (error) {
        console.error("Failed to load landlord detail:", error);
        setProperties([]);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    }
  
    if (landlord?.LandlordID) {
      loadLandlordDetail();
    }
  }, [landlord]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to landlords
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {landlord.Name || "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {landlord.City || "-"} • {landlord.Email || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">{landlord.Phone || "-"}</p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              String(landlord.Status || "").toLowerCase() === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {landlord.Status || "Unknown"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview" },
          { key: "properties", label: "Properties" },
          { key: "agreements", label: "Agreements" },
          { key: "payments", label: "Payments" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">Loading details...</div>
        ) : activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Landlord ID</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {landlord.LandlordID || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Properties</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {properties.length}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Status</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {landlord.Status || "Unknown"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Contact</p>
              <p className="mt-2 text-base text-slate-900">
                {landlord.Name || "-"} • {landlord.Phone || "-"} • {landlord.Email || "-"}
              </p>
            </div>
          </div>
        ) : activeTab === "properties" ? (
          properties.length === 0 ? (
            <div className="text-sm text-slate-500">
              No properties found for this landlord.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {properties.map((property) => (
                <div
                  key={property.PropertyID}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-base font-semibold text-slate-900">
                    {property.PropertyName}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {property.City} • {property.Neighborhood}
                  </p>

                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Type
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {property.PropertyType || "-"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Units
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {property.TotalUnits || 0}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">
                    {property.PropertyID}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "agreements" ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-base font-semibold text-slate-900">
                Platform Agreement
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This tab will hold landlord onboarding terms, signed dates, document status,
                and platform agreement tracking.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Suggested fields for launch tracking</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Agreement Status</li>
                <li>Signed Date</li>
                <li>Effective Date</li>
                <li>Revenue Share / Fee Terms</li>
                <li>Notes</li>
              </ul>
            </div>
          </div>
        ) : (
          payments.length === 0 ? (
            <div className="text-sm text-slate-500">No payments found.</div>
          ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.PaymentID} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <PaymentMeta payment={payment} />
                  </div>

                  <p className="text-sm font-semibold text-slate-900">
                    {formatFcfa(payment.AmountPaid || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          )
        )}
      </div>
    </div>
  );
}

function PropertiesView({
  userRole,
  landlordId,
  onAddProperty,
  onSelectProperty,
  onEditProperty,
}: {
  userRole?: string;
  landlordId?: string | null;
  onAddProperty: () => void;
  onSelectProperty: (property: any) => void;
  onEditProperty: (property: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [landlords, setLandlords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = userRole === "super_admin";

  useEffect(() => {
    async function loadPropertiesView() {
      setLoading(true);
      try {
          const [propertiesRes, landlordsRes] = await Promise.all([
            fetchProperties(),
            fetchLandlords(),
          ]);

          const allProperties = propertiesRes?.data || [];
          const allLandlords = landlordsRes?.data || [];

          const filteredProperties =
            userRole === "super_admin" || !landlordId
              ? allProperties
              : allProperties.filter(
                  (p: any) => String(p.LandlordID || "") === String(landlordId || "")
                );

          setProperties(filteredProperties);
          setLandlords(allLandlords);
      } catch (error) {
        console.error("Failed to load properties:", error);
        setProperties([]);
        setLandlords([]);
      } finally {
        setLoading(false);
      }
    }

    loadPropertiesView();
  }, []);

  function getLandlordName(landlordId: string) {
    const landlord = landlords.find(
      (l) => String(l.LandlordID || "") === String(landlordId || "")
    );
    return landlord?.Name || landlordId || "-";
  }

  const filteredProperties = properties.filter((p) => {
    const q = search.toLowerCase();
    return (
      String(p.PropertyName || "").toLowerCase().includes(q) ||
      String(p.City || "").toLowerCase().includes(q) ||
      String(p.Neighborhood || "").toLowerCase().includes(q) ||
      String(p.PropertyID || "").toLowerCase().includes(q) ||
      String(getLandlordName(p.LandlordID)).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Properties
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Browse all properties, locations, landlords, and unit counts from the same working pane.
            </p>
          </div>

          {canManage ? (
            <button
              onClick={onAddProperty}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Add property
            </button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "card"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Card
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "grid"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading properties...
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          No properties found.
        </div>
      ) : viewMode === "card" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span>
            <span>City</span>
            <span>Neighborhood</span>
            <span>Landlord</span>
            <span>Type</span>
            <span>ID</span>
            <span>Actions</span>
          </div>

          {filteredProperties.map((property) => (
            <div
              key={property.PropertyID}
              className="grid grid-cols-7 border-t border-slate-200 bg-white px-6 py-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">{property.PropertyName || "-"}</span>
              <span className="text-slate-600">{property.City || "-"}</span>
              <span className="text-slate-600">{property.Neighborhood || "-"}</span>
              <span className="text-slate-600">{getLandlordName(property.LandlordID)}</span>
              <span className="text-slate-600">{property.PropertyType || "-"}</span>
              <span className="font-medium text-slate-900">{property.PropertyID || "-"}</span>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => onSelectProperty(property)}
                 className="text-xs font-medium text-sky-600 hover:underline"
               >
                 View
               </button>

               {canManage ? (
                 <button
                   onClick={() => onEditProperty(property)}
                   className="text-xs font-medium text-amber-600 hover:underline"
                 >
                   Edit
                 </button>
               ) : null}
             </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProperties.map((property) => (
            <button
              key={property.PropertyID}
              onClick={() => onSelectProperty(property)}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {property.PropertyName || "-"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {property.City || "-"} • {property.Neighborhood || "-"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {property.PropertyType || "Unknown"}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p>Landlord: {getLandlordName(property.LandlordID)}</p>
                <p>Units: {property.TotalUnits || 0}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Property ID
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {property.PropertyID || "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyDetailView({
  property,
  onBack,
}: {
  property: any;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "units" | "tenants" | "payments" | "listing"
  >("overview");
  const [units, setUnits] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPropertyDetail() {
      setLoading(true);
      try {
        const [unitsRes, tenantsRes, paymentsRes] = await Promise.all([
          fetchAllUnits(),
          fetchTenants(),
          fetchPayments(),
        ]);
  
        const propertyId = String(property?.PropertyID || "");
  
        const allUnits = unitsRes?.data || [];
        const allTenants = tenantsRes?.data || [];
        const allPayments = paymentsRes?.data || [];
  
        setUnits(
          allUnits.filter((u: any) => String(u.PropertyID || "") === propertyId)
        );
  
        setTenants(
          allTenants.filter((t: any) => String(t.PropertyID || "") === propertyId)
        );
  
        setPayments(
          allPayments.filter((p: any) => String(p.PropertyID || "") === propertyId)
        );
      } catch (error) {
        console.error("Failed to load property detail:", error);
        setUnits([]);
        setTenants([]);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    }
  
    if (property?.PropertyID) {
      loadPropertyDetail();
    }
  }, [property]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to properties
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {property.PropertyName || "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {property.City || "-"} • {property.Neighborhood || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {property.PropertyType || "-"}
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {property.PropertyID || "No ID"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview" },
          { key: "units", label: "Units" },
          { key: "tenants", label: "Tenants" },
          { key: "payments", label: "Payments" },
          { key: "listing", label: "Listing" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">Loading details...</div>
        ) : activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Property ID</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {property.PropertyID || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Type</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {property.PropertyType || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Units</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {property.TotalUnits || 0}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Location</p>
              <p className="mt-2 text-base text-slate-900">
                {property.City || "-"} • {property.Neighborhood || "-"}
              </p>
            </div>
          </div>
        ) : activeTab === "units" ? (
          units.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
              No units found for this property.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {units.map((unit) => (
                <div key={unit.UnitID} className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-base font-semibold text-slate-900">
                    {unit.UnitNumber || "-"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {unit.UnitType || "-"} • {unit.Status || "Unknown"}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <p>Rent: {formatFcfa(unit.RentAmount || 0)}</p>
                    <p>Bedrooms: {unit.Bedrooms || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "tenants" ? (
          tenants.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
              No tenants found for this property.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tenants.map((tenant) => (
                <div key={tenant.TenantID} className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-base font-semibold text-slate-900">
                    {tenant.FullName || "-"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {tenant.UnitID || "-"} • {tenant.Status || "Unknown"}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <p>Rent: {formatFcfa(tenant.RentAmount || 0)}</p>
                    <p>Phone: {tenant.Phone || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "payments" ? (
          payments.length === 0 ? (
            <div className="text-sm text-slate-500">No payments found.</div>
          ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.PaymentID} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <PaymentMeta payment={payment} />
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {formatFcfa(payment.AmountPaid || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-base font-semibold text-slate-900">
                Listing readiness
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This tab will manage publish status, marketing description, and future unit photos for vacant units.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Suggested fields</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Publish Listing</li>
                <li>Short Description</li>
                <li>Neighborhood Highlights</li>
                <li>Image1 to Image5</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UnitsView({
  userRole,
  landlordId,
  onAddUnit,
  onSelectUnit,
  onEditUnit,
}: {
  userRole?: string;
  landlordId?: string | null;
  onAddUnit: () => void;
  onSelectUnit: (unit: any) => void;
  onEditUnit: (unit: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [search, setSearch] = useState("");
  const [units, setUnits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = userRole === "super_admin";

  useEffect(() => {
    async function loadUnitsView() {
      setLoading(true);
      try {
          const [unitsRes, propertiesRes] = await Promise.all([
            fetchAllUnits(),
            fetchProperties(),
          ]);

          const allUnits = unitsRes?.data || [];
          const allProperties = propertiesRes?.data || [];

          const allowedProperties =
            userRole === "super_admin" || !landlordId
              ? allProperties
              : allProperties.filter(
                  (p: any) => String(p.LandlordID || "") === String(landlordId || "")
                );

          const allowedPropertyIds = new Set(
            allowedProperties.map((p: any) => String(p.PropertyID || ""))
          );

          const filteredUnits = allUnits.filter((u: any) =>
            allowedPropertyIds.has(String(u.PropertyID || ""))
          );

          setUnits(filteredUnits);
          setProperties(allowedProperties);
      } catch (error) {
        console.error("Failed to load units:", error);
        setUnits([]);
        setProperties([]);
      } finally {
        setLoading(false);
      }
    }

    loadUnitsView();
  }, []);

  function getPropertyName(propertyId: string) {
    const property = properties.find(
      (p) => String(p.PropertyID || "") === String(propertyId || "")
    );
    return property?.PropertyName || propertyId || "-";
  }

  const filteredUnits = units.filter((u) => {
    const q = search.toLowerCase();
    return (
      String(u.UnitID || "").toLowerCase().includes(q) ||
      String(u.UnitNumber || "").toLowerCase().includes(q) ||
      String(u.UnitType || "").toLowerCase().includes(q) ||
      String(u.Status || "").toLowerCase().includes(q) ||
      String(getPropertyName(u.PropertyID)).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Units
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Browse all units, vacancy status, rent, and future listing information including images.
            </p>
          </div>

          {canManage ? (
            <button
              onClick={onAddUnit}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Add unit
            </button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search units..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "card"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Card
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "grid"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading units...
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          No units found.
        </div>
      ) : viewMode === "card" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-8 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Unit</span>
            <span>Property</span>
            <span>Type</span>
            <span>Status</span>
            <span>Rent</span>
            <span>Bedrooms</span>
            <span>ID</span>
            <span>Actions</span>
          </div>

          {filteredUnits.map((unit) => (
            <div
              key={unit.UnitID}
              className="grid grid-cols-8 border-t border-slate-200 bg-white px-6 py-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">{unit.UnitNumber || "-"}</span>
              <span className="text-slate-600">{getPropertyName(unit.PropertyID)}</span>
              <span className="text-slate-600">{unit.UnitType || "-"}</span>
              <span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(unit.Status || "").toLowerCase() === "vacant"
                      ? "bg-emerald-50 text-emerald-700"
                      : String(unit.Status || "").toLowerCase() === "occupied"
                      ? "bg-sky-50 text-sky-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {unit.Status || "Unknown"}
                </span>
              </span>
              <span className="text-slate-600">{formatFcfa(unit.RentAmount || 0)}</span>
              <span className="text-slate-600">{unit.Bedrooms || 0}</span>
              <span className="font-medium text-slate-900">{unit.UnitID || "-"}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSelectUnit(unit)}
                    className="text-xs font-medium text-sky-600 hover:underline"
                  >
                    View
                  </button>

                  {canManage ? (
                    <button
                      onClick={() => onEditUnit(unit)}
                      className="text-xs font-medium text-amber-600 hover:underline"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredUnits.map((unit) => (
            <button
              key={unit.UnitID}
              onClick={() => onSelectUnit(unit)}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {unit.UnitNumber || "-"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {getPropertyName(unit.PropertyID)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(unit.Status || "").toLowerCase() === "vacant"
                      ? "bg-emerald-50 text-emerald-700"
                      : String(unit.Status || "").toLowerCase() === "occupied"
                      ? "bg-sky-50 text-sky-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {unit.Status || "Unknown"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <p>Type: {unit.UnitType || "-"}</p>
                <p>Rent: {formatFcfa(unit.RentAmount || 0)}</p>
                <p>Bedrooms: {unit.Bedrooms || 0}</p>
                <p>Bathrooms: {unit.Bathrooms || 0}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Unit ID
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {unit.UnitID || "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitDetailView({
  unit,
  onBack,
}: {
  unit: any;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "tenant" | "payments" | "listing"
  >("overview");
  const [payments, setPayments] = useState<any[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUnitDetail() {
      setLoading(true);
      try {
        const [paymentsRes, propertiesRes, tenantsRes] = await Promise.all([
          fetchPayments(),
          fetchProperties(),
          fetchTenants(),
        ]);
  
        const unitId = String(unit?.UnitID || "");
        const propertyId = String(unit?.PropertyID || "");
  
        const allPayments = paymentsRes?.data || [];
        const allProperties = propertiesRes?.data || [];
        const allTenants = tenantsRes?.data || [];
  
        setPayments(
          allPayments.filter((p: any) => String(p.UnitID || "") === unitId)
        );
  
        setProperty(
          allProperties.find(
            (p: any) => String(p.PropertyID || "") === propertyId
          ) || null
        );
  
        setTenant(
          allTenants.find((t: any) => String(t.UnitID || "") === unitId) || null
        );
      } catch (error) {
        console.error("Failed to load unit detail:", error);
        setPayments([]);
        setProperty(null);
        setTenant(null);
      } finally {
        setLoading(false);
      }
    }
  
    if (unit?.UnitID) {
      loadUnitDetail();
    }
  }, [unit]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to units
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {unit.UnitNumber || "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {property?.PropertyName || unit.PropertyID || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {unit.UnitType || "-"} • {formatFcfa(unit.RentAmount || 0)}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              String(unit.Status || "").toLowerCase() === "vacant"
                ? "bg-emerald-50 text-emerald-700"
                : String(unit.Status || "").toLowerCase() === "occupied"
                ? "bg-sky-50 text-sky-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {unit.Status || "Unknown"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview" },
          { key: "tenant", label: "Tenant" },
          { key: "payments", label: "Payments" },
          { key: "listing", label: "Listing" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">Loading details...</div>
        ) : activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Unit ID</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit.UnitID || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Type</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit.UnitType || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Status</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit.Status || "Unknown"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Bedrooms</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit.Bedrooms || 0}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Bathrooms</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit.Bathrooms || 0}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Rent</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatFcfa(unit.RentAmount || 0)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Notes</p>
              <p className="mt-2 text-base text-slate-900">
                {unit.Notes || "No notes added."}
              </p>
            </div>
          </div>
        ) : activeTab === "tenant" ? (
          tenant ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Tenant</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {tenant.FullName || "-"}
                </p>
              </div>
          
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Phone</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {tenant.Phone || "-"}
                </p>
              </div>
          
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Rent</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {formatFcfa(tenant.RentAmount || 0)}
                </p>
              </div>
          
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Lease Start</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {tenant.LeaseStartDate || "-"}
                </p>
              </div>
          
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Lease End</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {tenant.LeaseEndDate || "-"}
                </p>
              </div>
          
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Status</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {tenant.Status || "Unknown"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
              No tenant is currently assigned to this unit.
            </div>
          )
        ) : activeTab === "payments" ? (
          payments.length === 0 ? (
            <div className="text-sm text-slate-500">No payments found.</div>
          ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.PaymentID} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <PaymentMeta payment={payment} />
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {formatFcfa(payment.AmountPaid || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-base font-semibold text-slate-900">
                Listing readiness
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This tab will manage vacancy marketing, descriptions, publish status, and 3–5 unit images.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Suggested fields</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Publish Listing</li>
                <li>Listing Title</li>
                <li>Short Description</li>
                <li>Image1 to Image5</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TenantsView({
  userRole,
  landlordId,
  onAddTenant,
  onSelectTenant,
  onEditTenant,
}: {
  userRole?: string;
  landlordId?: string | null;
  onAddTenant: () => void;
  onSelectTenant: (tenant: any) => void;
  onEditTenant: (tenant: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [search, setSearch] = useState("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenantsView() {
      setLoading(true);
      try {
          const [tenantsRes, propertiesRes, unitsRes] = await Promise.all([
            fetchTenants(),
            fetchProperties(),
            fetchAllUnits(),
          ]);

          const allTenants = tenantsRes?.data || [];
          const allProperties = propertiesRes?.data || [];
          const allUnits = unitsRes?.data || [];

          const allowedProperties =
            userRole === "super_admin" || !landlordId
              ? allProperties
              : allProperties.filter(
                  (p: any) => String(p.LandlordID || "") === String(landlordId || "")
                );

          const allowedPropertyIds = new Set(
            allowedProperties.map((p: any) => String(p.PropertyID || ""))
          );

          const allowedUnits = allUnits.filter((u: any) =>
            allowedPropertyIds.has(String(u.PropertyID || ""))
          );

          const allowedUnitIds = new Set(
            allowedUnits.map((u: any) => String(u.UnitID || ""))
          );

          const filteredTenants = allTenants.filter(
            (t: any) =>
              allowedPropertyIds.has(String(t.PropertyID || "")) ||
              allowedUnitIds.has(String(t.UnitID || ""))
          );

          setTenants(filteredTenants);
          setProperties(allowedProperties);
          setUnits(allowedUnits);
      } catch (error) {
        console.error("Failed to load tenants:", error);
        setTenants([]);
        setProperties([]);
        setUnits([]);
      } finally {
        setLoading(false);
      }
    }

    loadTenantsView();
  }, []);

  function getPropertyName(propertyId: string) {
    const property = properties.find(
      (p) => String(p.PropertyID || "") === String(propertyId || "")
    );
    return property?.PropertyName || propertyId || "-";
  }

  function getUnitLabel(unitId: string) {
    const unit = units.find(
      (u) => String(u.UnitID || "") === String(unitId || "")
    );
    return unit?.UnitNumber || unitId || "-";
  }

  const filteredTenants = tenants.filter((t) => {
    const q = search.toLowerCase();
    return (
      String(t.FullName || "").toLowerCase().includes(q) ||
      String(t.Phone || "").toLowerCase().includes(q) ||
      String(t.Email || "").toLowerCase().includes(q) ||
      String(t.TenantID || "").toLowerCase().includes(q) ||
      String(getPropertyName(t.PropertyID)).toLowerCase().includes(q) ||
      String(getUnitLabel(t.UnitID)).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Tenants
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Browse tenants by property and unit, with lease details, rent, status, and payment context.
            </p>
          </div>

          <button
            onClick={onAddTenant}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Register tenant
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "card"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Card
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "grid"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading tenants...
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          No tenants found.
        </div>
      ) : viewMode === "card" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-8 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span>
            <span>Property</span>
            <span>Unit</span>
            <span>Phone</span>
            <span>Status</span>
            <span>Rent</span>
            <span>ID</span>
            <span>Actions</span>
          </div>

          {filteredTenants.map((tenant) => (
            <div
              key={tenant.TenantID}
              className="grid grid-cols-8 border-t border-slate-200 bg-white px-6 py-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">{tenant.FullName || "-"}</span>
              <span className="text-slate-600">{getPropertyName(tenant.PropertyID)}</span>
              <span className="text-slate-600">{getUnitLabel(tenant.UnitID)}</span>
              <span className="text-slate-600">{tenant.Phone || "-"}</span>
              <span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(tenant.Status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tenant.Status || "Unknown"}
                </span>
              </span>
              <span className="text-slate-600">{formatFcfa(tenant.RentAmount || 0)}</span>
              <span className="font-medium text-slate-900">{tenant.TenantID || "-"}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onSelectTenant(tenant)}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  View
                </button>
                <button
                  onClick={() => onEditTenant(tenant)}
                  className="text-xs font-medium text-amber-600 hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant) => (
            <button
              key={tenant.TenantID}
              onClick={() => onSelectTenant(tenant)}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {tenant.FullName || "-"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {getPropertyName(tenant.PropertyID)} • {getUnitLabel(tenant.UnitID)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    String(tenant.Status || "").toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tenant.Status || "Unknown"}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p>{tenant.Phone || "-"}</p>
                <p>{tenant.Email || "-"}</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <p>Rent: {formatFcfa(tenant.RentAmount || 0)}</p>
                <p>Deposit: {formatFcfa(tenant.DepositPaid || 0)}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Tenant ID
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {tenant.TenantID || "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantDetailView({
  tenant,
  onBack,
}: {
  tenant: any;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "lease" | "payments" | "unit"
  >("overview");
  const [payments, setPayments] = useState<any[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenantDetail() {
      setLoading(true);
      try {
        const [paymentsRes, propertiesRes, unitsRes] = await Promise.all([
          fetchPayments(),
          fetchProperties(),
          fetchAllUnits(),
        ]);

        const allPayments = paymentsRes?.data || [];
        const allProperties = propertiesRes?.data || [];
        const allUnits = unitsRes?.data || [];

        setPayments(allPayments.filter((p: any) => String(p.TenantID || "") === String(tenant.TenantID || "")));
        setProperty(
          allProperties.find(
            (p: any) => String(p.PropertyID || "") === String(tenant.PropertyID || "")
          ) || null
        );
        setUnit(
          allUnits.find(
            (u: any) => String(u.UnitID || "") === String(tenant.UnitID || "")
          ) || null
        );
      } catch (error) {
        console.error("Failed to load tenant detail:", error);
        setPayments([]);
        setProperty(null);
        setUnit(null);
      } finally {
        setLoading(false);
      }
    }

    if (tenant?.TenantID) {
      loadTenantDetail();
    }
  }, [tenant]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to tenants
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {tenant.FullName || "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {property?.PropertyName || tenant.PropertyID || "-"} • {unit?.UnitNumber || tenant.UnitID || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {tenant.Phone || "-"} • {tenant.Email || "-"}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              String(tenant.Status || "").toLowerCase() === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {tenant.Status || "Unknown"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Overview" },
          { key: "lease", label: "Lease" },
          { key: "payments", label: "Payments" },
          { key: "unit", label: "Unit" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">Loading details...</div>
        ) : activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Tenant ID</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {tenant.TenantID || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Status</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {tenant.Status || "Unknown"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Rent</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatFcfa(tenant.RentAmount || 0)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Contact</p>
              <p className="mt-2 text-base text-slate-900">
                {tenant.FullName || "-"} • {tenant.Phone || "-"} • {tenant.Email || "-"}
              </p>
            </div>
          </div>
        ) : activeTab === "lease" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Lease Start</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {tenant.LeaseStartDate || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Lease End</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {tenant.LeaseEndDate || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Deposit Paid</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatFcfa(tenant.DepositPaid || 0)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Notes</p>
              <p className="mt-2 text-base text-slate-900">
                {tenant.Notes || "No notes added."}
              </p>
            </div>
          </div>
        ) : activeTab === "payments" ? (
          payments.length === 0 ? (
            <div className="text-sm text-slate-500">No payments found.</div>
          ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.PaymentID} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <PaymentMeta payment={payment} />
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {formatFcfa(payment.AmountPaid || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Property</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {property?.PropertyName || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Unit</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit?.UnitNumber || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Unit Status</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit?.Status || "-"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function PaymentsView({
  onLogPayment,
  onSelectPayment,
  onEditPayment,
}: {
  onLogPayment: () => void;
  onSelectPayment: (payment: any) => void;
  onEditPayment: (payment: any) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPaymentsView() {
      setLoading(true);
      try {
        const [paymentsRes, tenantsRes, propertiesRes, unitsRes] = await Promise.all([
          fetchPayments(),
          fetchTenants(),
          fetchProperties(),
          fetchAllUnits(),
        ]);

        setPayments(paymentsRes?.data || []);
        setTenants(tenantsRes?.data || []);
        setProperties(propertiesRes?.data || []);
        setUnits(unitsRes?.data || []);
      } catch (error) {
        console.error("Failed to load payments:", error);
        setPayments([]);
        setTenants([]);
        setProperties([]);
        setUnits([]);
      } finally {
        setLoading(false);
      }
    }

    loadPaymentsView();
  }, []);

  function getTenantName(tenantId: string) {
    const tenant = tenants.find(
      (t) => String(t.TenantID || "") === String(tenantId || "")
    );
    return tenant?.FullName || tenantId || "-";
  }

  function getPropertyName(propertyId: string) {
    const property = properties.find(
      (p) => String(p.PropertyID || "") === String(propertyId || "")
    );
    return property?.PropertyName || propertyId || "-";
  }

  function getUnitLabel(unitId: string) {
    const unit = units.find(
      (u) => String(u.UnitID || "") === String(unitId || "")
    );
    return unit?.UnitNumber || unitId || "-";
  }

  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      String(p.PaymentID || "").toLowerCase().includes(q) ||
      String(getTenantName(p.TenantID)).toLowerCase().includes(q) ||
      String(getPropertyName(p.PropertyID)).toLowerCase().includes(q) ||
      String(getUnitLabel(p.UnitID)).toLowerCase().includes(q) ||
      String(p.PaymentMethod || "").toLowerCase().includes(q) ||
      String(p.Reference || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Payments
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Browse payment activity across tenants, units, and properties.
            </p>
          </div>

          <button
            onClick={onLogPayment}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Log payment
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Search payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "card"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Card
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                viewMode === "grid"
                  ? "bg-sky-50 text-sky-700"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          Loading payments...
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          No payments found.
        </div>
      ) : viewMode === "card" ? (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Tenant</span>
            <span>Property</span>
            <span>Unit</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Date</span>
            <span>ID</span>
          </div>

          {filteredPayments.map((payment) => (
            <div
              key={payment.PaymentID}
              className="grid grid-cols-7 border-t border-slate-200 bg-white px-6 py-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">{payment.TenantName || payment.TenantID || "-"}</span>
              <span className="text-slate-600">{getPropertyName(payment.PropertyID)}</span>
              <span className="text-slate-600">{getUnitLabel(payment.UnitID)}</span>
              <span className="text-slate-600">{formatFcfa(payment.AmountPaid || 0)}</span>
              <span className="text-slate-600">{payment.PaymentMethod || "-"}</span>
              <span className="font-medium text-slate-900">{payment.PaymentID || "-"}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onSelectPayment(payment)}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  View
                </button>
                <button
                  onClick={() => onEditPayment(payment)}
                  className="text-xs font-medium text-amber-600 hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPayments.map((payment) => (
            <button
              key={payment.PaymentID}
              onClick={() => onSelectPayment(payment)}
              className="rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {getTenantName(payment.TenantID)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {getPropertyName(payment.PropertyID)} • {getUnitLabel(payment.UnitID)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {payment.PaymentMethod || "N/A"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <p>Amount: {formatFcfa(payment.AmountPaid || 0)}</p>
                <p>Date: {payment.PaymentDate
                  ? new Date(payment.PaymentDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "-"}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Payment ID
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {payment.PaymentID || "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentDetailView({
  payment,
  onBack,
}: {
  payment: any;
  onBack: () => void;
}) {
  const [tenant, setTenant] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPaymentDetail() {
      setLoading(true);
      try {
        const [tenantsRes, propertiesRes, unitsRes] = await Promise.all([
          fetchTenants(),
          fetchProperties(),
          fetchAllUnits(),
        ]);

        const allTenants = tenantsRes?.data || [];
        const allProperties = propertiesRes?.data || [];
        const allUnits = unitsRes?.data || [];

        setTenant(
          allTenants.find(
            (t: any) => String(t.TenantID || "") === String(payment.TenantID || "")
          ) || null
        );
        setProperty(
          allProperties.find(
            (p: any) => String(p.PropertyID || "") === String(payment.PropertyID || "")
          ) || null
        );
        setUnit(
          allUnits.find(
            (u: any) => String(u.UnitID || "") === String(payment.UnitID || "")
          ) || null
        );
      } catch (error) {
        console.error("Failed to load payment detail:", error);
        setTenant(null);
        setProperty(null);
        setUnit(null);
      } finally {
        setLoading(false);
      }
    }

    if (payment?.PaymentID) {
      loadPaymentDetail();
    }
  }, [payment]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to payments
        </button>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {payment.PaymentID || "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {tenant?.FullName || payment.TenantID || "-"} • {property?.PropertyName || payment.PropertyID || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatFcfa(payment.AmountPaid || 0)} • {payment.PaymentMethod || "N/A"}
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {payment.PaymentType || "Payment"}
          </span>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        {loading ? (
          <div className="text-sm text-slate-500">Loading details...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Payment ID</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {payment.PaymentID || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Amount Paid</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatFcfa(payment.AmountPaid || 0)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Balance After</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatFcfa(payment.BalanceAfter || 0)}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Tenant</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {tenant?.FullName || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Property</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {property?.PropertyName || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Unit</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {unit?.UnitNumber || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Payment Method</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {payment.PaymentMethod || "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Payment Date</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
              {payment.PaymentDate
                ? new Date(payment.PaymentDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Period Covered</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {payment.PeriodCovered
                ? new Date(payment.PeriodCovered).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "-"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 md:col-span-3">
              <p className="text-sm text-slate-500">Reference</p>
              <p className="mt-2 text-base text-slate-900">
                {payment.Reference || "No reference"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function TopBar({
  onMenuClick,
  userRole,
  onLogout,
}: {
  onMenuClick: () => void;
  userRole?: string;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="Open menu"
          >
            <span className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-slate-700" />
              <span className="block h-0.5 w-5 bg-slate-700" />
              <span className="block h-0.5 w-5 bg-slate-700" />
            </span>
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
              RENTFLOW
            </p>
          </div>
        </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-500">
              {userRole === "super_admin"
                ? "Super Admin"
                : userRole === "landlord"
                ? "Landlord"
                : "User"}
            </div>

            <button
              onClick={onLogout}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
      </div>
    </header>
  );
}

function Drawer({
  open,
  onClose,
  onOpenModal,
  activeView,
  onChangeView,
}: {
  open: boolean;
  onClose: () => void;
  onOpenModal: (
    modal: "addLandlord" | "addProperty" | "addUnit" | "addTenant" | "logPayment"
  ) => void;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
}) {
  const navItems: { key: ActiveView; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "landlords", label: "Landlords" },
    { key: "properties", label: "Properties" },
    { key: "units", label: "Units" },
    { key: "tenants", label: "Tenants" },
    { key: "payments", label: "Payments" },
    { key: "reports", label: "Reports" },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[320px] transform border-r border-slate-200 bg-white shadow-2xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
              RENTFLOW
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Admin Menu</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-5">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Navigation
          </p>

          <div className="mt-3 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onChangeView(item.key)}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium ${
                  activeView === item.key
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Actions
            </p>

            <div className="mt-3 space-y-2">
              <button
                onClick={() => onOpenModal("addLandlord")}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm font-medium text-white"
              >
                Register landlord
              </button>

              <button
                onClick={() => onOpenModal("addProperty")}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-800"
              >
                Add property
              </button>

              <button
                onClick={() => onOpenModal("addUnit")}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-800"
              >
                Add unit
              </button>

              <button
                onClick={() => onOpenModal("addTenant")}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-800"
              >
                Register tenant
              </button>

              <button
                onClick={() => onOpenModal("logPayment")}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-800"
              >
                Log payment
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function DashboardView({
  loading,
  summary,
  overdueTenants,
  properties,
  payments,
  units,
  tenants,
  vacantUnits,
  dataQualityIssues,
  spotlightProperty,
}: {
  loading: boolean;
  summary: any;
  overdueTenants: any[];
  properties: any[];
  payments: any[];
  units: any[];
  tenants: any[];
  vacantUnits: any[];
  dataQualityIssues: any[];
  spotlightProperty: any;
}) {
  const collectionRate =
    summary.expectedRent > 0
      ? Math.min(Math.round((safeNum(summary.collectedThisMonth) / safeNum(summary.expectedRent)) * 100), 100)
      : 0;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            RentFlow
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Property Management Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Operational analytics across occupancy, rent roll, collections, and data quality.
          </p>
        </div>

        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          tenant.playswithguru.com
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Occupancy Rate"
          value={loading ? "..." : `${summary.occupancyRate ?? 0}%`}
        />
        <StatCard
          label="Occupied Units"
          value={loading ? "..." : summary.occupiedUnits ?? 0}
        />
        <StatCard
          label="Vacant Units"
          value={loading ? "..." : summary.vacantUnits ?? 0}
        />
        <StatCard
          label="Expected Rent"
          value={loading ? "..." : formatFcfa(summary.expectedRent ?? 0)}
        />
        <StatCard
          label="Collected This Month"
          value={loading ? "..." : formatFcfa(summary.collectedThisMonth ?? 0)}
        />
        <StatCard
          label="Outstanding Rent"
          value={loading ? "..." : formatFcfa(summary.outstandingRent ?? 0)}
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Overdue tenants</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Active tenants with an outstanding balance that need follow-up
                </p>
              </div>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Send Reminders
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-5 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Tenant</span>
                <span>Property</span>
                <span>Unit</span>
                <span>Outstanding</span>
                <span>Lease Rent</span>
              </div>

              {overdueTenants.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-500">
                  No overdue tenants found.
                </div>
              ) : (
                overdueTenants.slice(0, 8).map((tenant: any) => (
                  <div
                    key={tenant.TenantID}
                    className="grid grid-cols-5 border-t border-slate-200 px-5 py-4 text-sm"
                  >
                    <span className="font-medium text-slate-900">
                      {tenant.FullName || "-"}
                    </span>
                    <span className="text-slate-600">{tenant.PropertyName || "-"}</span>
                    <span className="text-slate-600">{tenant.UnitNumber || "-"}</span>
                    <span className="font-medium text-rose-600">
                      {formatFcfa(tenant.Balance || 0)}
                    </span>
                    <span className="text-slate-700">
                      {formatFcfa(tenant.RentAmount || 0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Property overview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current properties in the system
                </p>
              </div>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                View All
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {properties.length === 0 ? (
                <div className="text-sm text-slate-500">No properties found.</div>
              ) : (
                properties.slice(0, 6).map((property: any) => {
                  const propertyUnits = units.filter(
                    (unit: any) => String(unit.PropertyID || "") === String(property.PropertyID || "")
                  );
                  const occupied = propertyUnits.filter(
                    (unit: any) => String(unit.Status || "").toLowerCase() === "occupied"
                  ).length;
                  const vacant = propertyUnits.filter(
                    (unit: any) => String(unit.Status || "").toLowerCase() === "vacant"
                  ).length;

                  return (
                    <div key={property.PropertyID} className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-base font-semibold text-slate-900">
                        {property.PropertyName}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {property.City} • {property.Neighborhood}
                      </p>
                      <div className="mt-5 flex items-end justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Type
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {property.PropertyType}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Units
                          </p>
                          <p className="mt-1 text-2xl font-semibold">
                            {property.TotalUnits || propertyUnits.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <span>Occupied: {occupied}</span>
                        <span>Vacant: {vacant}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Vacant units</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The quickest vacancy view for leasing follow-up
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {vacantUnits.length} open
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {vacantUnits.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  No vacant units right now.
                </div>
              ) : (
                vacantUnits.map((unit: any) => (
                  <div
                    key={unit.UnitID}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {unit.UnitNumber || unit.UnitID}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {unit.PropertyName || "-"} • {unit.UnitType || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatFcfa(unit.RentAmount || 0)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        Asking rent
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Collections progress</h2>
            <p className="mt-1 text-sm text-slate-500">Month-to-date performance</p>

            <div className="mt-6 rounded-3xl bg-slate-50 p-5">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Expected Rent</span>
                <span>{formatFcfa(summary.expectedRent ?? 0)}</span>
              </div>

              <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-600"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">Collected</span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatFcfa(summary.collectedThisMonth ?? 0)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>Collection Rate</span>
                <span>{collectionRate}%</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Data quality alerts</h2>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {dataQualityIssues.length} items
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {dataQualityIssues.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  No major setup gaps detected.
                </div>
              ) : (
                dataQualityIssues.map((issue: any, index: number) => (
                  <div
                    key={`${issue.type}-${issue.id}-${index}`}
                    className="rounded-2xl bg-slate-50 p-4"
                  >
                    <p className="font-medium text-slate-900">{issue.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{issue.detail}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">20 Roses snapshot</h2>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Live portfolio view
              </span>
            </div>

            {spotlightProperty ? (
              <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                <p className="text-lg font-semibold text-slate-900">
                  {spotlightProperty.PropertyName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {spotlightProperty.City} • {spotlightProperty.Neighborhood}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <MetricTile label="Units" value={spotlightProperty.TotalUnits || 0} />
                  <MetricTile label="Occupied" value={spotlightProperty.OccupiedUnits || 0} />
                  <MetricTile label="Vacant" value={spotlightProperty.VacantUnits || 0} />
                  <MetricTile
                    label="Expected Rent"
                    value={formatFcfa(spotlightProperty.ExpectedRent || 0)}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No spotlight property available yet.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent payments</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Updated live
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {payments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  No payments found yet.
                </div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.PaymentID} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <PaymentMeta payment={payment} tenantName={payment.TenantName} />
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.PropertyName || payment.PropertyID || "-"}
                        </p>
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {formatFcfa(payment.AmountPaid || 0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}


function computeDashboardSummary({
  backendSummary,
  properties,
  units,
  tenants,
  payments,
}: {
  backendSummary: any;
  properties: any[];
  units: any[];
  tenants: any[];
  payments: any[];
}) {
  const occupiedUnits = units.filter(
    (unit: any) => String(unit.Status || "").toLowerCase() === "occupied"
  ).length;
  const vacantUnits = units.filter(
    (unit: any) => String(unit.Status || "").toLowerCase() === "vacant"
  ).length;
  const activeTenants = tenants.filter((tenant: any) =>
    ["active", "notice"].includes(String(tenant.Status || "").toLowerCase())
  ).length;

    const expectedRent = tenants
      .filter((tenant: any) =>
        ["active", "notice"].includes(String(tenant.Status || "").toLowerCase())
      )
      .reduce((sum: number, tenant: any) => sum + safeNum(tenant.RentAmount), 0);

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const collectedThisMonth = payments
      .filter((payment: any) => {
        if (!payment.PaymentDate) return false;
        const date = new Date(payment.PaymentDate);
        return (
          !Number.isNaN(date.getTime()) &&
          date.getMonth() === month &&
          date.getFullYear() === year
        );
      })
      .reduce((sum: number, payment: any) => sum + safeNum(payment.AmountPaid), 0);

    const outstandingRent = Math.max(expectedRent - collectedThisMonth, 0);

  const occupancyRate =
    units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0;

  return {
    ...backendSummary,
    totalProperties: properties.length,
    totalUnits: units.length,
    occupiedUnits,
    vacantUnits,
    occupancyRate,
    activeTenants,
    expectedRent,
    collectedThisMonth,
    outstandingRent,
  };
}

function buildDataQualityIssues({
  properties,
  units,
  tenants,
}: {
  properties: any[];
  units: any[];
  tenants: any[];
}) {
  const issues: any[] = [];

  units.forEach((unit: any) => {
    if (safeNum(unit.RentAmount) <= 0) {
      issues.push({
        type: "unit-rent",
        id: unit.UnitID,
        title: `${unit.UnitNumber || unit.UnitID} is missing rent`,
        detail: "Set the unit asking rent so vacancy and pricing analytics are accurate.",
      });
    }

    if (
      String(unit.Status || "").toLowerCase() === "vacant" &&
      safeNum(unit.DepositAmount) <= 0
    ) {
      issues.push({
        type: "unit-deposit",
        id: unit.UnitID,
        title: `${unit.UnitNumber || unit.UnitID} has no deposit amount`,
        detail: "Vacant units should have a deposit amount configured before leasing.",
      });
    }
  });

  tenants.forEach((tenant: any) => {
    const missingLeaseDates = !tenant.LeaseStartDate || !tenant.LeaseEndDate;
    const missingContact = !tenant.Phone || !tenant.Email;

    if (missingLeaseDates) {
      issues.push({
        type: "tenant-lease",
        id: tenant.TenantID,
        title: `${tenant.FullName || tenant.TenantID} is missing lease dates`,
        detail: "Add both lease start and lease end dates for stronger rent-roll reporting.",
      });
    }

    if (missingContact) {
      issues.push({
        type: "tenant-contact",
        id: tenant.TenantID,
        title: `${tenant.FullName || tenant.TenantID} has incomplete contact info`,
        detail: "Capture both phone and email for reminders and statements.",
      });
    }
  });

  properties.forEach((property: any) => {
    if (!property.ManagerName || !property.ManagerPhone) {
      issues.push({
        type: "property-manager",
        id: property.PropertyID,
        title: `${property.PropertyName || property.PropertyID} is missing manager details`,
        detail: "Manager contact makes operations handoff and escalation cleaner.",
      });
    }
  });

  return issues;
}

function buildSpotlightProperty(
  properties: any[],
  units: any[],
  tenants: any[],
  payments: any[]
) {
  const spotlight =
    properties.find((property: any) =>
      String(property.PropertyName || "").toLowerCase().includes("20 roses")
    ) || properties[0];

  if (!spotlight) return null;

  const propertyUnits = units.filter(
    (unit: any) => String(unit.PropertyID || "") === String(spotlight.PropertyID || "")
  );
  const propertyTenants = tenants.filter(
    (tenant: any) => String(tenant.PropertyID || "") === String(spotlight.PropertyID || "")
  );
  const propertyPayments = payments.filter(
    (payment: any) => String(payment.PropertyID || "") === String(spotlight.PropertyID || "")
  );

  const occupiedUnits = propertyUnits.filter(
    (unit: any) => String(unit.Status || "").toLowerCase() === "occupied"
  ).length;
  const vacantUnits = propertyUnits.filter(
    (unit: any) => String(unit.Status || "").toLowerCase() === "vacant"
  ).length;
  const expectedRent = propertyTenants.reduce(
    (sum: number, tenant: any) => sum + safeNum(tenant.RentAmount),
    0
  );
  const outstandingRent = propertyTenants.reduce(
    (sum: number, tenant: any) => sum + safeNum(tenant.Balance),
    0
  );

  return {
    ...spotlight,
    TotalUnits: spotlight.TotalUnits || propertyUnits.length,
    OccupiedUnits: occupiedUnits,
    VacantUnits: vacantUnits,
    ExpectedRent: expectedRent,
    OutstandingRent: outstandingRent,
    PaymentCount: propertyPayments.length,
  };
}

function safeNum(value: any) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function RepositoryPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Complete the form below</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Close
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFcfa(value: number) {
  return `${Number(value || 0).toLocaleString()} FCFA`;
}
