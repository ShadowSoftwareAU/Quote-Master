import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateOnboardingProfile,
  getGetProfileSettingsQueryKey,
  useListTradeCatalogue,
} from "@workspace/api-client-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TradeMultiSelect } from "@/components/profile/TradeMultiSelect";

const onboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters").max(120),
  phoneNumber: z.string().trim().min(8, "Phone number must be at least 8 characters").max(20).regex(/^\+?[0-9 ()-]+$/, "Invalid phone number format"),
  role: z.enum(["Owner", "Employee", "Subcontractor"], { required_error: "Please select a role" }),
  tradeTypes: z.array(z.string().trim().min(2).max(80)).min(1, "Select at least one trade").max(3, "Select up to three trades"),
  licenseNumber: z.string().trim().regex(/^[A-Za-z0-9 ./-]+$/, "Invalid characters in license number").max(50).optional().or(z.literal("")),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { userId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProfile = useCreateOnboardingProfile();
  const { data: tradeCatalogue } = useListTradeCatalogue();
  const draftQueryKey = ["onboardingDraft", userId] as const;
  const cachedDraft =
    queryClient.getQueryData<Partial<OnboardingValues>>(draftQueryKey);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessName: cachedDraft?.businessName ?? "",
      phoneNumber: cachedDraft?.phoneNumber ?? "",
      role: cachedDraft?.role,
      tradeTypes: cachedDraft?.tradeTypes ?? [],
      licenseNumber: cachedDraft?.licenseNumber ?? "",
    },
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      queryClient.setQueryData(["onboardingDraft", userId], values);
    });
    return () => subscription.unsubscribe();
  }, [form, queryClient, userId]);

  function onSubmit(data: OnboardingValues) {
    createProfile.mutate(
      { 
        data: {
          businessName: data.businessName,
          phoneNumber: data.phoneNumber,
          role: data.role,
          tradeType: data.tradeTypes[0],
          tradeTypes: data.tradeTypes,
          licenseNumber: data.licenseNumber || null,
        }
      },
      {
        onSuccess: (profile) => {
          queryClient.setQueryData(
            [...getGetProfileSettingsQueryKey(), userId],
            profile,
          );
          queryClient.removeQueries({ queryKey: draftQueryKey, exact: true });
          setLocation("/");
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

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <img src={`${import.meta.env.BASE_URL}quote-master-logo.jpg`} alt="Quote Master" className="w-64 h-auto object-contain mb-4" />
          <h1 className="font-display font-black text-4xl uppercase tracking-tight text-foreground">Welcome to the Crew</h1>
          <p className="text-muted-foreground font-medium">Let's get your details set up so you can start quoting jobs.</p>
        </div>

        <Card className="border-2 shadow-sm">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <CardTitle className="font-display font-black uppercase text-xl text-center">Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Quote Master Pty Ltd" className="font-medium bg-card h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="0400 000 000" className="font-medium bg-card h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                </div>

                <FormField
                  control={form.control}
                  name="tradeTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trade Types</FormLabel>
                      <FormControl>
                        <TradeMultiSelect
                          entries={tradeCatalogue ?? []}
                          selected={field.value}
                          maxSelections={3}
                          disabled={createProfile.isPending}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <p className="text-xs font-medium text-muted-foreground/80">
                        Select up to three trades. The first is your primary trade.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Builder / Contractor License Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" className="font-medium bg-card h-12" {...field} />
                      </FormControl>
                      <p className="text-xs font-medium text-muted-foreground/80 mt-2">
                        License details are used to ensure quotes conform to Australian Building Codes and regulations.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-bold uppercase tracking-widest"
                    disabled={createProfile.isPending}
                  >
                    {createProfile.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
