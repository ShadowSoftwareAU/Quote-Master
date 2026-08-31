import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetProfileSettings, 
  getGetProfileSettingsQueryKey, 
  getGetDashboardSummaryQueryKey,
  getGetPnlReportQueryKey,
  getListCustomersQueryKey,
  getListMaterialsQueryKey,
  getListQuotesQueryKey,
  getListMasterProjectsQueryKey,
  useSeedDemoData,
  useUpdateProfileSettings 
} from "@workspace/api-client-react";
import { useEffect, useRef } from "react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const profileSchema = z.object({
  role: z.enum(["Owner", "Employee", "Subcontractor"], { required_error: "Please select a role" }),
  tradeType: z.string().trim().min(2, "Trade type must be at least 2 characters").max(80),
  licenseNumber: z.string().trim().regex(/^[A-Za-z0-9 ./-]+$/, "Invalid characters in licence number").max(50).optional().or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfileSettings() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const profileQueryKey = [...getGetProfileSettingsQueryKey(), userId];
  const { data: profile, isLoading, error, refetch } = useGetProfileSettings({
    query: {
      enabled: isLoaded && isSignedIn,
      retry: false,
      queryKey: profileQueryKey,
    }
  });

  const updateProfile = useUpdateProfileSettings();
  const seedDemoData = useSeedDemoData();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      role: undefined,
      tradeType: "",
      licenseNumber: "",
    },
  });

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (profile && initializedForId.current !== userId) {
      initializedForId.current = userId as string;
      form.reset({
        role: profile.role,
        tradeType: profile.tradeType,
        licenseNumber: profile.licenseNumber || "",
      });
    }
  }, [profile, userId, form]);

  function onSubmit(data: ProfileValues) {
    updateProfile.mutate(
      { 
        data: {
          role: data.role,
          tradeType: data.tradeType,
          licenseNumber: data.licenseNumber || null,
        }
      },
      {
        onSuccess: (updatedProfile) => {
          queryClient.setQueryData(profileQueryKey, updatedProfile);
          queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
          form.reset({
            role: updatedProfile.role,
            tradeType: updatedProfile.tradeType,
            licenseNumber: updatedProfile.licenseNumber || "",
          });
          toast({
            title: "Profile saved",
            description: "Your settings have been successfully updated.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Could not save profile",
            description: err?.message || "Please check your inputs and try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  function seedPresentationData() {
    seedDemoData.mutate(
      { data: {} },
      {
        onSuccess: (result) => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetPnlReportQueryKey() }),
          ]);
          toast({
            title: "Demo data ready",
            description: `Created ${result.counts.customers} customers, ${result.counts.materials} materials, ${result.counts.quotes} quotes, and a Master Project.`,
          });
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number; message?: string };
          toast({
            title: apiError.status === 409 ? "Demo data already exists" : "Could not seed demo data",
            description: apiError.status === 409
              ? "This Owner workspace has already been prepared for the presentation."
              : apiError.message || "Please try again.",
            variant: apiError.status === 409 ? "default" : "destructive",
          });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center max-w-md mx-auto">
        <h2 className="font-display font-black text-2xl uppercase text-foreground">Ah, bugger</h2>
        <p className="text-muted-foreground">We couldn't load your profile settings.</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
          <UserCog className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground font-medium">Manage your trade details and view your system role.</p>
        </div>
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <CardTitle className="font-display font-black uppercase text-xl">Business Profile</CardTitle>
          <CardDescription>Your core business contact details (read-only).</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Name</label>
            <div className="mt-1 p-3 bg-muted rounded-md text-foreground font-medium border border-border">
              {profile?.businessName || "Not set"}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
            <div className="mt-1 p-3 bg-muted rounded-md text-foreground font-medium border border-border">
              {profile?.phoneNumber || "Not set"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <CardTitle className="font-display font-black uppercase text-xl">Trade Settings</CardTitle>
          <CardDescription>Your role is managed by an Owner. You can update your trade credentials.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled>
                      <FormControl>
                        <SelectTrigger className="font-medium bg-card h-12">
                          <SelectValue placeholder="Select role..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Owner">Owner</SelectItem>
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tradeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Trade Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Carpenter, Landscaper" className="font-medium bg-card h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Builder / Contractor Licence Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" className="font-medium bg-card h-12" {...field} />
                    </FormControl>
                    <p className="text-xs font-medium text-muted-foreground/80 mt-2">
                      Licence details are used to ensure quotes conform to Australian Building Codes and regulations.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-base font-bold uppercase tracking-widest"
                  disabled={updateProfile.isPending || !form.formState.isDirty}
                >
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {profile?.role === "Owner" && (
        <Card className="border-2 border-dashed border-amber-500/60 shadow-sm">
          <CardHeader className="bg-amber-500/10 border-b pb-6">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              <CardTitle className="font-display font-black uppercase text-xl">
                Temporary Demo Setup
              </CardTitle>
            </div>
            <CardDescription>
              Development only. Creates presentation customers, materials, quotes, and one Master Project for this Owner workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 font-bold uppercase tracking-wider"
              disabled={seedDemoData.isPending}
              onClick={seedPresentationData}
            >
              {seedDemoData.isPending ? "Seeding Demo Data..." : "Seed Demo Data"}
            </Button>
            <p className="text-xs text-muted-foreground">
              This action can only run once and is not available in production.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}