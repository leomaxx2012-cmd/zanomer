import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import VercelAnalytics from "../lib/vercel-analytics";
import YandexMetrika from "../lib/yandex-metrika";

export default function RootLayout() {
  return (
    <>
      <Head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="ru" />
        <title>ЗаНомером</title>
      </Head>
      <VercelAnalytics />
      <YandexMetrika />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
