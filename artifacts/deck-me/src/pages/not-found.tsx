import { Link } from "wouter";
import { Hammer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
      <div className="bg-destructive/10 p-6 rounded-full inline-flex">
        <AlertTriangle className="w-16 h-16 text-destructive" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Yeah, Nah.</h1>
        <p className="text-xl text-muted-foreground font-medium max-w-md mx-auto">
          We couldn't find the page you're lookin' for. Probably fell off the back of the ute.
        </p>
      </div>

      <Link href="/">
        <Button className="font-bold uppercase h-12 px-8 mt-4">
          <Hammer className="w-5 h-5 mr-2" />
          Back to the Tools
        </Button>
      </Link>
    </div>
  );
}
