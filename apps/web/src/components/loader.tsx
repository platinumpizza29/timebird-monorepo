import { Loader2 } from "lucide-react";

// Lightweight loading indicator used for auth and route loading.
export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}
