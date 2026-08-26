import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, UserButton, useUser } from "@clerk/react";
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
import Customers from "@/pages/customers";
import Materials from "@/pages/materials";
import Bookings from "@/pages/bookings";
import TeamPage from "@/pages/team";
import PlannerPage from "@/pages/planner";
import PortfolioPage from "@/pages/portfolio";
import ReferralsPage from "@/pages/referrals";
import FinancePage from "@/pages/finance";
import Projects from "@/pages/projects";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL ?? "";

if (!clerkPubKey) {
  throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
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

function Router() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/quote/:id" component={QuotePortal} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/calculator" component={Calculator} />
            <Route path="/quotes" component={Quotes} />
            <Route path="/quotes/:id" component={QuoteDetail} />
            <Route path="/customers" component={Customers} />
            <Route path="/materials" component={Materials} />
            <Route path="/bookings" component={Bookings} />
            <Route path="/team" component={TeamPage} />
            <Route path="/planner" component={PlannerPage} />
            <Route path="/portfolio" component={PortfolioPage} />
            <Route path="/referrals" component={ReferralsPage} />
            <Route path="/finance" component={FinancePage} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={Projects} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
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
              subtitle: "Sign in to access Deck Me",
            },
          },
          signUp: {
            start: {
              title: "Create your Deck Me account",
              subtitle: "Set up your account to get started",
            },
          },
        }}
        appearance={{
          theme: shadcn,
          options: { logoPlacement: "inside", logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, logoLinkUrl: basePath || "/" },
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
