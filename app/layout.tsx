import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
title: "ZARA AI PREDICTOR | WinGo 1M",
description:
"WinGo 1 Minute history analysis, automatic signal tracking and prediction performance dashboard.",
applicationName: "ZARA AI PREDICTOR",
};

export const viewport: Viewport = {
width: "device-width",
initialScale: 1,
themeColor: "#070a0c",
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html lang="en">
<body>{children}</body>
</html>
);
}
