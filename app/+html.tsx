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
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
