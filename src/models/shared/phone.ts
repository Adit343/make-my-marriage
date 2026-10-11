/** E.164: "+" then 8 to 15 digits, no spaces (DB Design §3.5). */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
