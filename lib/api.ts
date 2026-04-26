const API_BASE = "/api/rentflow";

async function parseJson(res: Response) {
  const text = await res.text();

  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || `Request failed with status ${res.status}`);
  }

  if (json?.success === false) {
    throw new Error(json?.error || "API request failed");
  }

  return json;
}

async function getAction(
  action: string,
  params?: Record<string, string | number | undefined | null>
) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set("action", action);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  return parseJson(res);
}

async function postAction<T extends Record<string, any>>(
  action: string,
  payload: T
) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  return parseJson(res);
}

export async function healthCheck() {
  return getAction("healthCheck");
}

export async function fetchDashboardSummary() {
  return getAction("getDashboardSummary");
}

export async function getSettings() {
  return getAction("getSettings");
}

export async function fetchLandlords() {
  return getAction("getLandlords");
}

export async function addLandlord(payload: {
  Name: string;
  Phone?: string;
  Email?: string;
  Address?: string;
  City?: string;
  Country?: string;
  Status?: string;
  Notes?: string;
}) {
  return postAction("addLandlord", payload);
}

export async function updateLandlord(payload: {
  LandlordID: string;
  Name: string;
  Phone?: string;
  Email?: string;
  Address?: string;
  City?: string;
  Country?: string;
  Status?: string;
  Notes?: string;
}) {
  return postAction("updateLandlord", payload);
}

export async function fetchProperties(landlordId?: string) {
  return getAction("getProperties", { landlordId });
}

export async function fetchAllProperties() {
  return getAction("getProperties");
}

export async function addProperty(payload: {
  LandlordID: string;
  PropertyName: string;
  Address?: string;
  City?: string;
  Neighborhood?: string;
  PropertyType?: string;
  TotalUnits?: string | number;
  ManagerName?: string;
  ManagerPhone?: string;
  Country?: string;
  Status?: string;
  Notes?: string;
}) {
  return postAction("addProperty", payload);
}

export async function updateProperty(payload: {
  PropertyID: string;
  LandlordID: string;
  PropertyName: string;
  Address?: string;
  City?: string;
  Neighborhood?: string;
  PropertyType?: string;
  TotalUnits?: string | number;
  ManagerName?: string;
  ManagerPhone?: string;
  Country?: string;
  Status?: string;
  Notes?: string;
}) {
  return postAction("updateProperty", payload);
}

export async function fetchAllUnits() {
  return getAction("getUnits");
}

export async function getUnits(propertyId?: string) {
  return getAction("getUnits", { propertyId });
}

export async function addUnit(payload: {
  PropertyID: string;
  UnitNumber: string;
  UnitType?: string;
  Bedrooms?: string | number;
  Bathrooms?: string | number;
  Floor?: string | number;
  RentAmount?: string | number;
  DepositAmount?: string | number;
  Status?: string;
  Notes?: string;
}) {
  return postAction("addUnit", payload);
}

export async function updateUnit(payload: {
  UnitID: string;
  PropertyID: string;
  UnitNumber: string;
  UnitType?: string;
  Bedrooms?: string | number;
  Bathrooms?: string | number;
  Floor?: string | number;
  RentAmount?: string | number;
  DepositAmount?: string | number;
  Status?: string;
  Notes?: string;
}) {
  return postAction("updateUnit", payload);
}

export async function fetchTenants(propertyId?: string) {
  return getAction("getTenants", { propertyId });
}

export async function fetchAllTenants() {
  return getAction("getTenants");
}

export async function addTenant(payload: {
  FullName: string;
  Phone?: string;
  Email?: string;
  NationalID?: string;
  PropertyID?: string;
  UnitID: string;
  LeaseStartDate?: string;
  LeaseEndDate?: string;
  RentAmount?: string | number;
  DepositPaid?: string | number;
  Balance?: string | number;
  Status?: string;
  EmergencyContact?: string;
  Notes?: string;
}) {
  return postAction("addTenant", payload);
}

export async function updateTenant(payload: {
  TenantID: string;
  FullName: string;
  Phone?: string;
  Email?: string;
  NationalID?: string;
  PropertyID?: string;
  UnitID: string;
  LeaseStartDate?: string;
  LeaseEndDate?: string;
  RentAmount?: string | number;
  DepositPaid?: string | number;
  Balance?: string | number;
  Status?: string;
  EmergencyContact?: string;
  Notes?: string;
}) {
  return postAction("updateTenant", payload);
}

export async function fetchPayments(propertyId?: string) {
  return getAction("getPayments", { propertyId });
}

export async function addPayment(payload: {
  TenantID: string;
  PropertyID?: string;
  UnitID?: string;
  PaymentDate: string;
  AmountPaid?: string | number;
  PaymentType?: string;
  PeriodCovered?: string;
  BalanceAfter?: string | number;
  PaymentMethod?: string;
  Reference?: string;
  RecordedBy?: string;
  Notes?: string;
}) {
  return postAction("addPayment", payload);
}

export async function updatePayment(payload: {
  PaymentID: string;
  TenantID: string;
  PropertyID?: string;
  UnitID?: string;
  PaymentDate: string;
  AmountPaid?: string | number;
  PaymentType?: string;
  PeriodCovered?: string;
  BalanceAfter?: string | number;
  PaymentMethod?: string;
  Reference?: string;
  RecordedBy?: string;
  Notes?: string;
}) {
  return postAction("updatePayment", payload);
}

export async function recordPayment(payload: {
  TenantID: string;
  PaymentDate: string;
  Amount?: string | number;
  AmountPaid?: string | number;
  PaymentType?: string;
  PaymentMethod?: string;
  Reference?: string;
  PeriodCovered?: string;
  Notes?: string;
}) {
  return postAction("recordPayment", payload);
}

export async function fetchOverdueTenants(propertyId?: string) {
  return getAction("getOverdueTenants", { propertyId });
}

export async function getMaintenanceRequests(params?: {
  tenantId?: string;
  status?: string;
}) {
  return getAction("getMaintenanceRequests", params);
}

export async function submitMaintenanceRequest(payload: {
  TenantID: string;
  PropertyID?: string;
  UnitID?: string;
  Title: string;
  Description: string;
  Priority?: string;
  AssignedTo?: string;
  Notes?: string;
}) {
  return postAction("submitMaintenanceRequest", payload);
}

export async function updateMaintenanceRequestStatus(payload: {
  RequestID: string;
  Status: "Open" | "In Progress" | "Resolved" | "Closed";
  Notes?: string;
}) {
  return postAction("updateMaintenanceRequestStatus", payload);
}

export async function getTenantProfile(tenantId: string) {
  return getAction("getTenantProfile", { tenantId });
}

export async function getTenantLease(tenantId: string) {
  return getAction("getTenantLease", { tenantId });
}

export async function getTenantPayments(tenantId: string) {
  return getAction("getTenantPayments", { tenantId });
}

export async function getTenantMaintenanceRequests(tenantId: string) {
  return getAction("getTenantMaintenanceRequests", { tenantId });
}

export async function loginUser(payload: { Email: string }) {
  return postAction("loginUser", payload);
}
