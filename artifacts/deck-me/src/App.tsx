import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function Router() {
  return (
    <Switch>
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
