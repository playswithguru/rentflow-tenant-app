"use client";

import RentFlowGate from "@/components/RentFlowGate";
import { AuthProvider } from "@/firebase/AuthContext";

export default function Page() {
  return (
    <AuthProvider>
      <RentFlowGate />
    </AuthProvider>
  );
}
