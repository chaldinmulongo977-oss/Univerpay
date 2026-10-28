import Image from "next/image";

export function Logo({ size = 40, withText = false }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/logo.svg" alt="UniPay" width={size} height={size} priority />
      {withText && <span className="text-lg font-bold tracking-tight">UniPay</span>}
    </span>
  );
}
