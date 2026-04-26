export type DashboardSummary = {
    totalProperties: number;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    activeTenants: number;
    expectedRent: number;
    collectedThisMonth: number;
    outstandingRent: number;
  };
  
  export type Property = {
    PropertyID: string;
    LandlordID: string;
    PropertyName: string;
    Address: string;
    City: string;
    Neighborhood: string;
    PropertyType: string;
    TotalUnits: number;
    ManagerName: string;
    ManagerPhone: string;
    Status: string;
    CreatedAt: string;
  };
  
  export type Tenant = {
    TenantID: string;
    FullName: string;
    Phone: string;
    Email: string;
    NationalID: string;
    PropertyID: string;
    UnitID: string;
    LeaseStartDate: string;
    LeaseEndDate: string;
    RentAmount: number;
    DepositPaid: number;
    Status: string;
    EmergencyContact: string;
    CreatedAt: string;
    Notes: string;
  };
  
  export type Payment = {
    PaymentID: string;
    TenantID: string;
    PropertyID: string;
    UnitID: string;
    PaymentDate: string;
    AmountPaid: number;
    PaymentType: string;
    PeriodCovered: string;
    BalanceAfter: number;
    PaymentMethod: string;
    Reference: string;
    RecordedBy: string;
    CreatedAt: string;
  };