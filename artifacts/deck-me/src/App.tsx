import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Calculator from "@/pages/calculator";
import Quotes from "@/pages/quotes";
import QuoteDetail from "@/pages/quote-detail";
import QuotePortal from "@/pages/quote-portal";
import MasterProjectPortal from "@/pages/master-project-portal";
import Customers from "@/pages/customers";
import Materials from "@/pages/materials";
import MaterialImport from "@/pages/material-import";
import Bookings from "@/pages/bookings";
import TeamPage from "@/pages/team";
import PlannerPage from "@/pages/planner";
import PortfolioPage from "@/pages/portfolio";
import ReferralsPage from "@/pages/referrals";
import FinancePage from "@/pages/finance";
import Projects from "@/pages/projects";
import Onboarding from "@/pages/onboarding";
import ProfileSettings from "@/pages/settings-profile";
import { ProfileAccessProvider, useProfileAccess } from "@/lib/access";
import {
  useGetAssignmentAccess,
  getGetAssignmentAccessQueryKey,
  useGetProfileSettings,
  getGetProfileSettingsQueryKey,
} from "@workspace/api-client-react";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { user } = useUser();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }, [user?.id]);
  return null;
}

function ProtectedWorkspace() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [location, setLocation] = useLocation();
  const profileQueryKey = [...getGetProfileSettingsQueryKey(), userId];
  const assignmentAccessQueryKey = [...getGetAssignmentAccessQueryKey(), userId];
  const { data: assignmentAccess, isLoading: assignmentAccessLoading } = useGetAssignmentAccess({
    query: {
      enabled: isLoaded && isSignedIn,
      queryKey: assignmentAccessQueryKey,
      refetchOnWindowFocus: location !== "/onboarding",
      refetchInterval: location === "/onboarding" ? false : 10_000,
    },
  });

  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useGetProfileSettings({
    query: {
      enabled: isLoaded && isSignedIn,
      retry: false,
      queryKey: profileQueryKey,
      refetchOnWindowFocus: location !== "/onboarding",
      refetchInterval: location === "/onboarding" ? false : 10_000,
    }
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/sign-in");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  const is404 =
    profileError &&
    typeof profileError === "object" &&
    "status" in profileError &&
    profileError.status === 404;
  const isOtherError = profileError && !is404 && !assignmentAccess?.linked;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || profileLoading || assignmentAccessLoading) return;
    if (is404 && !assignmentAccess?.linked && location !== "/onboarding") {
      setLocation("/onboarding");
    } else if ((profile || assignmentAccess?.linked) && location === "/onboarding") {
      setLocation("/");
    }
  }, [
    is404,
    isLoaded,
    isSignedIn,
    location,
    profile,
    profileLoading,
    assignmentAccess,
    assignmentAccessLoading,
    setLocation,
  ]);

  if (!isLoaded || !isSignedIn) {
    return <div className="min-h-[100dvh] bg-background" aria-label="Loading" />;
  }

  if (profileLoading || assignmentAccessLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium animate-pulse uppercase tracking-widest text-sm">Loading Workspace</p>
      </div>
    );
  }

  if (isOtherError) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="font-display font-black text-4xl uppercase tracking-tight text-foreground">Ah, bugger</h1>
          <p className="text-muted-foreground text-lg">We couldn't connect to the server to grab your profile. Check your connection.</p>
          <button
            onClick={() => refetchProfile()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground min-h-12 px-8 font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (
    (is404 && !assignmentAccess?.linked && location !== "/onboarding") ||
    ((profile || assignmentAccess?.linked) && location === "/onboarding")
  ) {
    return null;
  }

  if (location === "/onboarding") {
    return <Onboarding />;
  }

  return (
    <ProfileAccessProvider profile={profile ?? null} assignmentAccess={assignmentAccess} identity={{ userId }}>
      <WorkspaceRoutes />
    </ProfileAccessProvider>
  );
}

function RestrictedPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-black uppercase">{title} unavailable</h1>
      <p className="text-muted-foreground">Your current business role does not include access to this area.</p>
    </div>
  );
}

function WorkspaceRoutes() {
  const { canManageTeam, canViewFinancials, canViewDashboard, canViewGeneralWorkspace, isSubcontractor } = useProfileAccess();
  return (
    <Layout>
      <Switch>
        <Route path="/" component={canViewDashboard ? Dashboard : () => <RestrictedPage title="Dashboard" />} />
        <Route path="/calculator" component={canViewGeneralWorkspace ? Calculator : () => <RestrictedPage title="Calculator" />} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route path="/customers" component={canViewGeneralWorkspace ? Customers : () => <RestrictedPage title="Customers" />} />
        <Route path="/materials" component={canViewGeneralWorkspace ? Materials : () => <RestrictedPage title="Materials" />} />
        <Route path="/materials/import" component={canViewGeneralWorkspace ? MaterialImport : () => <RestrictedPage title="Material Import" />} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/team" component={canManageTeam ? TeamPage : () => <RestrictedPage title="Team management" />} />
        <Route path="/planner" component={canManageTeam ? PlannerPage : () => <RestrictedPage title="Planner" />} />
        <Route path="/portfolio" component={canViewGeneralWorkspace ? PortfolioPage : () => <RestrictedPage title="Gallery" />} />
        <Route path="/referrals" component={canViewGeneralWorkspace ? ReferralsPage : () => <RestrictedPage title="Referrals" />} />
        <Route path="/finance" component={canViewFinancials ? FinancePage : () => <RestrictedPage title="Financials" />} />
        <Route path="/projects" component={canManageTeam ? Projects : () => <RestrictedPage title="Projects" />} />
        <Route path="/projects/:id" component={canManageTeam ? Projects : () => <RestrictedPage title="Projects" />} />
        <Route path="/settings/profile" component={ProfileSettings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/quote/:token" component={QuotePortal} />
      <Route path="/master-project/:token" component={MasterProjectPortal} />
      <Route component={ProtectedWorkspace} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={{
          signIn: {
            start: {
              title: "Welcome back",
              subtitle: "Sign in to access Quote Master",
            },
          },
          signUp: {
            start: {
              title: "Create your Quote Master account",
              subtitle: "Set up your account to get started",
            },
          },
        }}
        appearance={{
          theme: shadcn,
          options: { logoPlacement: "inside", logoImageUrl: `${window.location.origin}${basePath}/quote-master-logo.jpg`, logoLinkUrl: basePath || "/" },
          elements: {
            socialButtonsBlockButton: "!text-black",
            socialButtonsBlockButtonText: "!text-black",
          },
          variables: { colorPrimary: "#f97316", colorForeground: "#1b1d24", colorMutedForeground: "#68707d", colorBackground: "#ffffff", colorInput: "#ffffff", colorInputForeground: "#1b1d24", colorNeutral: "#d8dbe0", fontFamily: "Inter, sans-serif", borderRadius: "0.5rem" },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ClerkQueryClientCacheInvalidator />
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </WouterRouter>
  );
}

export default App;
