import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google-site-verification" content="BgfE_AT54j318BVifv_-yDZvLXrEdmF51hTn1Js4iT0" />
        <meta name="yandex-verification" content="40eb5b43b825700c" />
        <meta name="theme-color" content="#151723" />
        <meta name="color-scheme" content="dark" />
        <style>{`html,body,#root{background:var(--page-background,#151723);color:var(--page-text,#F4F3FA);}a{color:var(--page-link,#C4B5FD);}input::placeholder,textarea::placeholder{color:var(--page-muted,#B2B6C9);opacity:1;}`}</style>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
