import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import LegalNoticePage from "./pages/legal/LegalNoticePage";
import TermsPage from "./pages/legal/TermsPage";
import CookiesPage from "./pages/legal/CookiesPage";
import CookieNotice from "./components/CookieNotice";
import DropPage from "./pages/DropPage";
import LandingPage from "./pages/LandingPage";
import HoldPage from "./pages/HoldPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import PurchasesPage from "./pages/PurchasesPage";
import ReceiptPage from "./pages/ReceiptPage";
import EmptyStatesPage from "./pages/EmptyStatesPage";
import ProfilePage from "./pages/ProfilePage";
import DropDetailPage from "./pages/DropDetailPage";
import CreateDropPage from "./pages/CreateDropPage";
import PaymentSettingsPage from "./pages/PaymentSettingsPage";
import BecomeDropperPage from "./pages/BecomeDropperPage";
import MyDropsPage from "./pages/MyDropsPage";
import ManageDropPage from "./pages/ManageDropPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminRequestsPage from "./pages/admin/AdminRequestsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminDropsPage from "./pages/admin/AdminDropsPage";
import AdminDropEditPage from "./pages/admin/AdminDropEditPage";
import { getAccessToken } from "./services/tokenStorage";
import { useProfile } from "./hooks/useProfile";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getAccessToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

// Gate on the DB role (source of truth, read via useProfile). While the profile
// loads we show nothing; a plain Chaser is bounced to the drop screen.
function RequireDropper({ children }: { children: React.ReactNode }) {
  const { profile, error } = useProfile();
  if (error) return <Navigate to="/drop" replace />;
  if (!profile) return <div className="min-h-dvh bg-background" />;
  const canCreate = profile.role === "DROPPER" || profile.role === "ADMIN";
  return canCreate ? <>{children}</> : <Navigate to="/drop" replace />;
}

// Admin-only gate. Same shape as RequireDropper but requires the ADMIN role.
// Server-side checks are the real enforcement; this only reflects access.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, error } = useProfile();
  if (error) return <Navigate to="/drop" replace />;
  if (!profile) return <div className="min-h-dvh bg-background" />;
  return profile.role === "ADMIN" ? <>{children}</> : <Navigate to="/drop" replace />;
}

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public landing / home — no auth gate. Adapts to the visitor's auth. */}
      <Route path="/" element={<HomePage />} />
      {/* Public legal pages (RGPD). */}
      <Route path="/confidentialite" element={<PrivacyPage />} />
      <Route path="/mentions-legales" element={<LegalNoticePage />} />
      <Route path="/cgu" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route
        path="/drop"
        element={
          <RequireAuth>
            <DropPage />
          </RequireAuth>
        }
      />
      {/* A specific live drop (switcher target). Same page, id from the route. */}
      <Route
        path="/drop/:id"
        element={
          <RequireAuth>
            <DropPage />
          </RequireAuth>
        }
      />
      <Route
        path="/upcoming"
        element={
          <RequireAuth>
            <LandingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/upcoming/:id"
        element={
          <RequireAuth>
            <DropDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/hold"
        element={
          <RequireAuth>
            <HoldPage />
          </RequireAuth>
        }
      />
      <Route
        path="/confirmation"
        element={
          <RequireAuth>
            <ConfirmationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchases"
        element={
          <RequireAuth>
            <PurchasesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchases/:id"
        element={
          <RequireAuth>
            <ReceiptPage />
          </RequireAuth>
        }
      />
      <Route
        path="/empty"
        element={
          <RequireAuth>
            <EmptyStatesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <RequireDropper>
              <CreateDropPage />
            </RequireDropper>
          </RequireAuth>
        }
      />
      <Route
        path="/settings/payments"
        element={
          <RequireAuth>
            <RequireDropper>
              <PaymentSettingsPage />
            </RequireDropper>
          </RequireAuth>
        }
      />
      <Route
        path="/become-dropper"
        element={
          <RequireAuth>
            <BecomeDropperPage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-drops"
        element={
          <RequireAuth>
            <RequireDropper>
              <MyDropsPage />
            </RequireDropper>
          </RequireAuth>
        }
      />
      <Route
        path="/my-drops/:id"
        element={
          <RequireAuth>
            <RequireDropper>
              <ManageDropPage />
            </RequireDropper>
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminRequestsPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/drops"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDropsPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/drops/:id/edit"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDropEditPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      </Routes>
      <CookieNotice />
    </>
  );
}
