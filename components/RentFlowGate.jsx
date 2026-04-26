"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../firebase/AuthContext";
import RentFlowDashboard from "./RentFlowDashboard";

function AccessDenied({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Access not granted
        </h1>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

export default function RentFlowGate() {
  const router = useRouter();
  const { user, loading, userDoc, userDocLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !userDocLoading && !user) {
      router.replace("/login");
    }
  }, [mounted, loading, userDocLoading, user, router]);

  if (!mounted) return null;

  if (loading || userDocLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  if (!userDoc) {
    return <AccessDenied message="User profile not found." />;
  }

  const isMasterAdmin =
    String(user?.email || "").toLowerCase() === "playswithguru@gmail.com";

  const rentflowRole = isMasterAdmin
    ? "super_admin"
    : userDoc.rentflowAccess?.role || userDoc.role || "user";

  const hasRentFlowApp = isMasterAdmin || userDoc.apps?.rentflow === true;

  const hasDashboardAccess =
    isMasterAdmin ||
    userDoc.rentflowAccess?.dashboard === true ||
    rentflowRole === "super_admin";

  if (!hasRentFlowApp) {
    return <AccessDenied message="RentFlow is not enabled for this account." />;
  }

  if (!hasDashboardAccess) {
    return (
      <AccessDenied message="Dashboard access is not enabled for this account." />
    );
  }

  const landlordId =
    rentflowRole === "super_admin"
      ? null
      : userDoc.rentflowAccess?.landlordId || null;

  return <RentFlowDashboard userRole={rentflowRole} landlordId={landlordId} />;
}
