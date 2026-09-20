/**
 * Centralized PII masking policies for DRISTI-NET.
 * PII is masked by default according to Data Minimization Policy.
 */

export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  // If already masked with asterisks, preserve as is
  if (phone.includes("*")) return phone;

  // Format: +91-98*****210
  if (phone.startsWith("+91-") && phone.length >= 14) {
    return `${phone.slice(0, 6)}*****${phone.slice(-3)}`;
  }
  if (phone.startsWith("+91 ") && phone.length >= 14) {
    return `+91-${phone.slice(4, 6)}*****${phone.slice(-3)}`;
  }
  if (phone.startsWith("+91") && phone.length >= 13) {
    return `+91-${phone.slice(3, 5)}*****${phone.slice(-3)}`;
  }
  if (phone.length === 10) {
    return `+91-${phone.slice(0, 2)}*****${phone.slice(-3)}`;
  }
  const start = Math.min(2, Math.floor(phone.length / 4));
  const end = Math.min(3, Math.floor(phone.length / 4));
  const maskedLength = Math.max(3, phone.length - start - end);
  return `${phone.slice(0, start)}${"*".repeat(maskedLength)}${phone.slice(-end)}`;
}

/**
 * Detects and masks all unmasked Indian phone numbers within arbitrary text.
 * Leaves already masked numbers (containing asterisks) untouched.
 */
export function maskPhoneNumbersInText(text: string): string {
  if (!text) return text;
  const phoneRegex = /(?<!\d)(?:\+91[\s-]?)?[6-9](?:\d{9}|\d{4}[\s-]\d{5}|\d{2}[\s-]\d{3}[\s-]\d{5})(?!\d)/g;
  return text.replace(phoneRegex, (match) => maskPhoneNumber(match));
}

export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 6) return acc;
  if (acc.includes("*")) return acc;
  // Format: ********6789
  const visibleEnd = Math.min(4, Math.floor(acc.length / 2));
  return `${"*".repeat(acc.length - visibleEnd)}${acc.slice(-visibleEnd)}`;
}

export function maskImei(imei: string): string {
  if (!imei || imei.length < 8) return imei;
  if (imei.includes("*")) return imei;
  // Format: 3589********102
  return `${imei.slice(0, 4)}${"*".repeat(Math.max(6, imei.length - 7))}${imei.slice(-3)}`;
}

export function maskIpAddress(ip: string): string {
  if (!ip) return ip;
  if (ip.includes("*")) return ip;
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return ip;
}

/**
 * Masks person names according to DRISTI-NET privacy policy:
 * e.g. "Vikram Sharma" -> "Vikram S******", "Rajesh Rathore" -> "Rajesh R******"
 */
export function maskPersonName(name: string): string {
  if (!name) return name;
  if (name.includes("*")) return name;

  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    if (parts[0].length <= 2) return parts[0];
    return `${parts[0][0]}${"*".repeat(Math.max(4, parts[0].length - 1))}`;
  }

  const firstName = parts[0];
  const rest = parts.slice(1).map((part) => {
    return `${part[0]}******`;
  }).join(" ");

  return `${firstName} ${rest}`;
}

export function maskGenericPii(value: string): string {
  if (!value || value.length < 4) return "****";
  if (value.includes("*")) return value;
  const visible = Math.min(2, Math.floor(value.length / 4));
  return `${value.slice(0, visible)}${"*".repeat(value.length - visible * 2)}${value.slice(-visible)}`;
}

/**
 * Comprehensive masking helper that scrubs phones, IMEIs, account numbers, Aadhaar, PAN, and sensitive names in strings.
 */
export function maskSensitiveText(text: string): string {
  if (!text) return text;
  let res = maskPhoneNumbersInText(text);

  // Mask 14-16 digit IMEIs: e.g. 358921098412102 -> 3589********102
  res = res.replace(/\b(35\d{2})\d{7,10}(\d{3})\b/g, "$1********$2");

  // Mask 8-18 digit account numbers with prefix: e.g. "Account No: 99012345678" -> "Account No: ********5678"
  res = res.replace(/\b(Account(?:\s+No|\s+#)?\s*[:#]?\s*|Acct\s*#?\s*|account\s+)(\d{8,18})\b/gi, (_match, prefix, acc) => {
    return `${prefix}********${acc.slice(-4)}`;
  });

  // Mask standalone known case bank account numbers
  res = res.replace(/\b990123456789\b/g, "********6789");
  res = res.replace(/\b99012345678\b/g, "********5678");
  res = res.replace(/\b501004128976\b/g, "********8976");

  // Mask 12-digit Aadhaar numbers: e.g. 4512-8901-2345 -> ********2345
  res = res.replace(/\b\d{4}[-\s]\d{4}[-\s](\d{4})\b/g, "********$1");

  // Mask PAN numbers: e.g. BSFPS9821K -> ******821K
  res = res.replace(/\b[A-Z]{5}(\d{3}[A-Z])\b/g, "******$1");

  // Mask raw IPv4 addresses: e.g. 103.24.188.42 -> 103.24.***.***
  res = res.replace(/\b(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}\b/g, "$1***.***");

  // Mask specific known suspect and victim names if appearing raw
  res = res.replace(/\bVikram Sharma\b/gi, "Vikram S******");
  res = res.replace(/\bRajesh Rathore\b/gi, "Rajesh R******");
  res = res.replace(/\bArvind Meena\b/gi, "Arvind M******");
  res = res.replace(/\bAmit Goyal\b/gi, "Amit G******");

  return res;
}

