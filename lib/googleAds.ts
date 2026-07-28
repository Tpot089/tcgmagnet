export function fireSubmitLeadFormConversion(
  formType?: "rebates" | "financing" | "home" | "tcg_magnet"
) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  const sendTo = process.env.NEXT_PUBLIC_TCG_GOOGLE_ADS_SEND_TO;
  if (!sendTo) return;

  const params: Record<string, any> = {
    send_to: sendTo,
  };

  if (formType) params.form_type = formType;

  window.gtag("event", "conversion", params);
}
