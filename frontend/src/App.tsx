import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BranchProvider } from "./BranchContext";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Branches from "./pages/Branches";
import SoftwareSettings from "./pages/SoftwareSettings";
import Users from "./pages/Users";
import StaffDetail from "./pages/StaffDetail";
import VehicleMakes from "./pages/VehicleMakes";
import VehicleModels from "./pages/VehicleModels";
import CreateJobCard from "./pages/CreateJobCard";
import JobCards from "./pages/JobCards";
import JobCardDetailPage from "./pages/JobCardDetail";
import Billing from "./pages/Billing";
import InvoiceDetailPage from "./pages/InvoiceDetail";
import CalendarPage from "./pages/Calendar";
import CameraSettings from "./pages/CameraSettings";
import Client360 from "./pages/Client360";
import Connectors from "./pages/Connectors";
import Clients from "./pages/Clients";
import ClientDetailPage from "./pages/ClientDetail";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Vendors from "./pages/Vendors";
import VendorLedger from "./pages/VendorLedger";
import Enquiry from "./pages/Enquiry";
import SettingsDashboard from "./pages/SettingsDashboard";
import Offers from "./pages/Offers";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Diagnostics from "./pages/Diagnostics";
import DiagnosticReportPage from "./pages/DiagnosticReport";
import GarageMap from "./pages/GarageMap";

function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <BranchProvider>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/signup"} replace />} />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <Setup />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/branches"
          element={
            <RequireAuth>
              <Branches />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/software"
          element={
            <RequireAuth>
              <SoftwareSettings />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth>
              <Users />
            </RequireAuth>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <RequireAuth>
              <StaffDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/vehicle-makes"
          element={
            <RequireAuth>
              <VehicleMakes />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/vehicle-models"
          element={
            <RequireAuth>
              <VehicleModels />
            </RequireAuth>
          }
        />
        <Route
          path="/job-cards"
          element={
            <RequireAuth>
              <JobCards />
            </RequireAuth>
          }
        />
        <Route
          path="/job-cards/new"
          element={
            <RequireAuth>
              <CreateJobCard />
            </RequireAuth>
          }
        />
        <Route
          path="/job-cards/:id"
          element={
            <RequireAuth>
              <JobCardDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/cameras"
          element={
            <RequireAuth>
              <CameraSettings />
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/billing"
          element={
            <RequireAuth>
              <Billing />
            </RequireAuth>
          }
        />
        <Route
          path="/billing/:id"
          element={
            <RequireAuth>
              <InvoiceDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/client-360"
          element={
            <RequireAuth>
              <Client360 />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/connectors"
          element={
            <RequireAuth>
              <Connectors />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/offers"
          element={
            <RequireAuth>
              <Offers />
            </RequireAuth>
          }
        />
        <Route
          path="/clients"
          element={
            <RequireAuth>
              <Clients />
            </RequireAuth>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <RequireAuth>
              <ClientDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/products"
          element={
            <RequireAuth>
              <Products />
            </RequireAuth>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireAuth>
              <Inventory />
            </RequireAuth>
          }
        />
        <Route
          path="/vendors"
          element={
            <RequireAuth>
              <Vendors />
            </RequireAuth>
          }
        />
        <Route
          path="/vendors/:id/ledger"
          element={
            <RequireAuth>
              <VendorLedger />
            </RequireAuth>
          }
        />
        <Route
          path="/enquiry"
          element={
            <RequireAuth>
              <Enquiry />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Reports />
            </RequireAuth>
          }
        />
        <Route
          path="/expenses"
          element={
            <RequireAuth>
              <Expenses />
            </RequireAuth>
          }
        />
        <Route
          path="/diagnostics"
          element={
            <RequireAuth>
              <Diagnostics />
            </RequireAuth>
          }
        />
        <Route
          path="/diagnostics/:id"
          element={
            <RequireAuth>
              <DiagnosticReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/garage-map"
          element={
            <RequireAuth>
              <GarageMap />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BranchProvider>
    </BrowserRouter>
  );
}
