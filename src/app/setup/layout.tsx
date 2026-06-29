import "@/index.css";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>Grace Music — Server Setup</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="bg-transparent text-white">
        {children}
      </body>
    </html>
  );
}

