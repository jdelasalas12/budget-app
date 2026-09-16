import "./globals.css";

import { AuthProvider } from "@/app/components/auth/AuthProvider";
import { UserProfileProvider } from "@/app/components/auth/UserProfileProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <UserProfileProvider>{children}</UserProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
