// crypto.randomUUID() only works in secure contexts (HTTPS or localhost).
// Shop staff commonly open this app over plain HTTP via the LAN IP of the
// machine running it (e.g. http://192.168.1.5:5173), where that API is
// undefined and throws immediately. This works everywhere.
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
