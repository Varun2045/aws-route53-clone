import type { Metadata } from "next";
import { AppProvider } from "@/context/AppContext";
import AWSLayout from "@/components/AWSLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Route 53 Console",
  description: "Mock AWS Route53 DNS management console clone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AppProvider>
          <AWSLayout>
            {children}
          </AWSLayout>
        </AppProvider>
      </body>
    </html>
  );
}
