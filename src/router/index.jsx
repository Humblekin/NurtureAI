import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import AuthLayout from '../features/auth/AuthLayout';
import Login from '../features/auth/Login';
import Register from '../features/auth/Register';
import ForgotPassword from '../features/auth/ForgotPassword';
import RoleRedirect from '../features/auth/RoleRedirect';
import AuthGuard from '../features/auth/AuthGuard';
import MotherDashboard from '../features/dashboard/MotherDashboard';
import CHWDashboard from '../features/dashboard/CHWDashboard';
import NurseDashboard from '../features/dashboard/NurseDashboard';
import DoctorDashboard from '../features/dashboard/DoctorDashboard';
import DistrictDashboard from '../features/dashboard/DistrictDashboard';
import AdminDashboard from '../features/dashboard/AdminDashboard';
import MotherList from '../features/mothers/MotherList';
import MotherForm from '../features/mothers/MotherForm';
import MotherProfile from '../features/mothers/MotherProfile';
import ChildList from '../features/children/ChildList';
import ChildForm from '../features/children/ChildForm';
import ChildProfile from '../features/children/ChildProfile';
import VisitList from '../features/visits/VisitList';
import VisitForm from '../features/visits/VisitForm';
import ReferralList from '../features/referrals/ReferralList';
import ReferralForm from '../features/referrals/ReferralForm';
import AminaChat from '../features/amina/AminaChat';
import SettingsPage from '../features/settings/SettingsPage';
import MotherHealth from '../features/health/MotherHealth';
import PregnancyFormPage from '../features/pregnancies/PregnancyFormPage';
import AppointmentList from '../features/health/AppointmentList';
import HealthJourneyPage from '../features/timeline/HealthJourneyPage';
import ReportsPage from '../features/reports/ReportsPage';
import AdminUsers from '../features/admin/AdminUsers';
import AdminFacilities from '../features/admin/AdminFacilities';
import AdminArchive from '../features/admin/AdminArchive';
import OnboardingFlow from '../features/amina/OnboardingFlow';
import MotherWelcome from '../features/amina/MotherWelcome';
import OnboardingForm from '../features/amina/OnboardingForm';
import WeeklyTrackPage from '../features/track/WeeklyTrackPage';
import PregnancyAminaFlow from '../features/pregnancies/PregnancyAminaFlow';
import PregnancyRegister from '../features/pregnancies/PregnancyRegister';
import PatientSearch from '../features/patients/PatientSearch';

const A = AuthGuard;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RoleRedirect /> },

      // ─── Mother Portal ────────────────────────────────────
      {
        path: 'mother/welcome',
        element: <A allowedRoles={['mother']}><MotherWelcome /></A>
      },
      {
        path: 'mother/amina',
        element: <A allowedRoles={['mother']}><AminaChat /></A>
      },
      {
        path: 'mother/onboarding/form',
        element: <A allowedRoles={['mother']}><OnboardingForm /></A>
      },
      {
        path: 'mother/onboarding',
        element: <A allowedRoles={['mother']}><OnboardingFlow /></A>
      },
      {
        path: 'mother/dashboard',
        element: <A allowedRoles={['mother']}><MotherDashboard /></A>
      },
      {
        path: 'mother/timeline',
        element: <A allowedRoles={['mother']}><HealthJourneyPage /></A>
      },
      {
        path: 'mother/track',
        element: <A allowedRoles={['mother']}><WeeklyTrackPage /></A>
      },
      {
        path: 'mother/pregnancy',
        element: <A allowedRoles={['mother']}><MotherHealth /></A>
      },
      {
        path: 'mother/pregnancy/new',
        element: <A allowedRoles={['mother']}><PregnancyFormPage /></A>
      },
      {
        path: 'mother/pregnancy/amina',
        element: <A allowedRoles={['mother']}><PregnancyAminaFlow /></A>
      },
      {
        path: 'mother/children',
        element: <A allowedRoles={['mother']}><ChildList /></A>
      },
      {
        path: 'mother/children/new',
        element: <A allowedRoles={['mother']}><ChildForm /></A>
      },
      {
        path: 'mother/children/:id',
        element: <A allowedRoles={['mother']}><ChildProfile /></A>
      },
      {
        path: 'mother/children/:id/edit',
        element: <A allowedRoles={['mother']}><ChildForm /></A>
      },
      {
        path: 'mother/appointments',
        element: <A allowedRoles={['mother']}><AppointmentList /></A>
      },

      // ─── CHW Portal ───────────────────────────────────────
      {
        path: 'chw/dashboard',
        element: <A allowedRoles={['chw']}><CHWDashboard /></A>
      },
      {
        path: 'chw/patients',
        element: <A allowedRoles={['chw']}><PatientSearch /></A>
      },
      {
        path: 'chw/mothers',
        element: <A allowedRoles={['chw']}><MotherList /></A>
      },
      {
        path: 'chw/mothers/new',
        element: <A allowedRoles={['chw']}><MotherForm /></A>
      },
      {
        path: 'chw/mothers/:id',
        element: <A allowedRoles={['chw']}><MotherProfile /></A>
      },
      {
        path: 'chw/mothers/:id/edit',
        element: <A allowedRoles={['chw']}><MotherForm /></A>
      },
      {
        path: 'chw/children',
        element: <A allowedRoles={['chw']}><ChildList /></A>
      },
      {
        path: 'chw/children/new',
        element: <A allowedRoles={['chw']}><ChildForm /></A>
      },
      {
        path: 'chw/children/:id',
        element: <A allowedRoles={['chw']}><ChildProfile /></A>
      },
      {
        path: 'chw/children/:id/edit',
        element: <A allowedRoles={['chw']}><ChildForm /></A>
      },
      {
        path: 'chw/visits',
        element: <A allowedRoles={['chw']}><VisitList /></A>
      },
      {
        path: 'chw/visits/new',
        element: <A allowedRoles={['chw']}><VisitForm /></A>
      },
      {
        path: 'chw/visits/:id/edit',
        element: <A allowedRoles={['chw']}><VisitForm /></A>
      },
      {
        path: 'chw/referrals',
        element: <A allowedRoles={['chw']}><ReferralList /></A>
      },
      {
        path: 'chw/referrals/new',
        element: <A allowedRoles={['chw']}><ReferralForm /></A>
      },

      // ─── Nurse Portal ─────────────────────────────────────
      {
        path: 'nurse/dashboard',
        element: <A allowedRoles={['nurse']}><NurseDashboard /></A>
      },
      {
        path: 'nurse/patients',
        element: <A allowedRoles={['nurse']}><PatientSearch /></A>
      },
      {
        path: 'nurse/mothers',
        element: <A allowedRoles={['nurse']}><MotherList /></A>
      },
      {
        path: 'nurse/mothers/new',
        element: <A allowedRoles={['nurse']}><MotherForm /></A>
      },
      {
        path: 'nurse/mothers/:id',
        element: <A allowedRoles={['nurse']}><MotherProfile /></A>
      },
      {
        path: 'nurse/mothers/:id/edit',
        element: <A allowedRoles={['nurse']}><MotherForm /></A>
      },
      {
        path: 'nurse/anc',
        element: <A allowedRoles={['nurse']}><AppointmentList /></A>
      },
      {
        path: 'nurse/appointments',
        element: <A allowedRoles={['nurse']}><AppointmentList /></A>
      },
      {
        path: 'nurse/children',
        element: <A allowedRoles={['nurse']}><ChildList /></A>
      },
      {
        path: 'nurse/children/new',
        element: <A allowedRoles={['nurse']}><ChildForm /></A>
      },
      {
        path: 'nurse/children/:id',
        element: <A allowedRoles={['nurse']}><ChildProfile /></A>
      },
      {
        path: 'nurse/children/:id/edit',
        element: <A allowedRoles={['nurse']}><ChildForm /></A>
      },
      {
        path: 'nurse/visits',
        element: <A allowedRoles={['nurse']}><VisitList /></A>
      },
      {
        path: 'nurse/visits/new',
        element: <A allowedRoles={['nurse']}><VisitForm /></A>
      },
      {
        path: 'nurse/visits/:id/edit',
        element: <A allowedRoles={['nurse']}><VisitForm /></A>
      },
      {
        path: 'nurse/referrals',
        element: <A allowedRoles={['nurse']}><ReferralList /></A>
      },
      {
        path: 'nurse/referrals/new',
        element: <A allowedRoles={['nurse']}><ReferralForm /></A>
      },
      {
        path: 'nurse/reports',
        element: <A allowedRoles={['nurse']}><ReportsPage /></A>
      },

      // ─── Doctor Portal ────────────────────────────────────
      {
        path: 'doctor/dashboard',
        element: <A allowedRoles={['doctor']}><DoctorDashboard /></A>
      },
      {
        path: 'doctor/patients',
        element: <A allowedRoles={['doctor']}><PatientSearch /></A>
      },
      {
        path: 'doctor/mothers',
        element: <A allowedRoles={['doctor']}><MotherList /></A>
      },
      {
        path: 'doctor/mothers/new',
        element: <A allowedRoles={['doctor']}><MotherForm /></A>
      },
      {
        path: 'doctor/mothers/:id',
        element: <A allowedRoles={['doctor']}><MotherProfile /></A>
      },
      {
        path: 'doctor/mothers/:id/edit',
        element: <A allowedRoles={['doctor']}><MotherForm /></A>
      },
      {
        path: 'doctor/visits',
        element: <A allowedRoles={['doctor']}><VisitList /></A>
      },
      {
        path: 'doctor/visits/new',
        element: <A allowedRoles={['doctor']}><VisitForm /></A>
      },
      {
        path: 'doctor/visits/:id/edit',
        element: <A allowedRoles={['doctor']}><VisitForm /></A>
      },
      {
        path: 'doctor/children',
        element: <A allowedRoles={['doctor']}><ChildList /></A>
      },
      {
        path: 'doctor/children/new',
        element: <A allowedRoles={['doctor']}><ChildForm /></A>
      },
      {
        path: 'doctor/children/:id',
        element: <A allowedRoles={['doctor']}><ChildProfile /></A>
      },
      {
        path: 'doctor/children/:id/edit',
        element: <A allowedRoles={['doctor']}><ChildForm /></A>
      },
      {
        path: 'doctor/referrals',
        element: <A allowedRoles={['doctor']}><ReferralList /></A>
      },
      {
        path: 'doctor/referrals/new',
        element: <A allowedRoles={['doctor']}><ReferralForm /></A>
      },
      {
        path: 'doctor/reports',
        element: <A allowedRoles={['doctor']}><ReportsPage /></A>
      },

      // ─── District Officer Portal ──────────────────────────
      {
        path: 'district/dashboard',
        element: <A allowedRoles={['district_officer']}><DistrictDashboard /></A>
      },
      {
        path: 'district/facilities',
        element: <A allowedRoles={['district_officer']}><AdminFacilities /></A>
      },
      {
        path: 'district/reports',
        element: <A allowedRoles={['district_officer']}><ReportsPage /></A>
      },
      {
        path: 'district/users',
        element: <A allowedRoles={['district_officer']}><AdminUsers /></A>
      },

      // ─── Admin Portal ─────────────────────────────────────
      {
        path: 'admin/dashboard',
        element: <A allowedRoles={['admin']}><AdminDashboard /></A>
      },
      {
        path: 'admin/users',
        element: <A allowedRoles={['admin']}><AdminUsers /></A>
      },
      {
        path: 'admin/mothers',
        element: <A allowedRoles={['admin']}><MotherList /></A>
      },
      {
        path: 'admin/mothers/new',
        element: <A allowedRoles={['admin']}><MotherForm /></A>
      },
      {
        path: 'admin/mothers/:id',
        element: <A allowedRoles={['admin']}><MotherProfile /></A>
      },
      {
        path: 'admin/mothers/:id/edit',
        element: <A allowedRoles={['admin']}><MotherForm /></A>
      },
      {
        path: 'admin/children',
        element: <A allowedRoles={['admin']}><ChildList /></A>
      },
      {
        path: 'admin/children/new',
        element: <A allowedRoles={['admin']}><ChildForm /></A>
      },
      {
        path: 'admin/children/:id',
        element: <A allowedRoles={['admin']}><ChildProfile /></A>
      },
      {
        path: 'admin/children/:id/edit',
        element: <A allowedRoles={['admin']}><ChildForm /></A>
      },
      {
        path: 'admin/visits',
        element: <A allowedRoles={['admin']}><VisitList /></A>
      },
      {
        path: 'admin/visits/new',
        element: <A allowedRoles={['admin']}><VisitForm /></A>
      },
      {
        path: 'admin/visits/:id/edit',
        element: <A allowedRoles={['admin']}><VisitForm /></A>
      },
      {
        path: 'admin/facilities',
        element: <A allowedRoles={['admin', 'district_officer']}><AdminFacilities /></A>
      },
      {
        path: 'admin/referrals',
        element: <A allowedRoles={['admin']}><ReferralList /></A>
      },
      {
        path: 'admin/referrals/new',
        element: <A allowedRoles={['admin']}><ReferralForm /></A>
      },
      {
        path: 'admin/reports',
        element: <A allowedRoles={['admin']}><ReportsPage /></A>
      },
      {
        path: 'admin/archive',
        element: <A allowedRoles={['admin']}><AdminArchive /></A>
      },

      // ─── Shared Routes ────────────────────────────────────
      {
        path: 'shared/amina',
        element: <A><AminaChat /></A>
      },
      {
        path: 'shared/settings',
        element: <A><SettingsPage /></A>
      },

      // ─── Legacy Flat Routes (redirects) ───────────────────
      { path: 'dashboard', element: <RoleRedirect /> },
      { path: 'amina', element: <Navigate to="/shared/amina" replace /> },
      { path: 'settings', element: <Navigate to="/shared/settings" replace /> },
      { path: 'health', element: <Navigate to="/mother/pregnancy" replace /> },
      { path: 'mothers', element: <Navigate to="/chw/mothers" replace /> },
      { path: 'children', element: <Navigate to="/chw/children" replace /> },
      { path: 'visits', element: <Navigate to="/chw/visits" replace /> },
      { path: 'referrals', element: <Navigate to="/chw/referrals" replace /> },
    ]
  },

  // ─── Auth Routes ──────────────────────────────────────────
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> }
    ]
  },

  { path: '*', element: <Navigate to="/" replace /> }
]);

export default router;
