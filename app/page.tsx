import { Suspense } from "react";
import TcgMagnetLanding from "@/components/TcgMagnetLanding";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <TcgMagnetLanding />
    </Suspense>
  );
}
